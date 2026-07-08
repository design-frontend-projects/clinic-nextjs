import { createClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateTempPassword } from "@/lib/user-creation";
import { routing } from "@/i18n/routing";

/**
 * Account-creation + credential-delivery helpers built on Supabase Auth admin.
 *
 * New users are created directly via `auth.admin.createUser` with their email
 * pre-confirmed and a generated **temporary password** that the caller surfaces
 * to the inviting admin (no dependency on Supabase SMTP). Existing users can be
 * (re-)sent a recovery link via `auth.resetPasswordForEmail`.
 *
 * IMPORTANT: the DB has an active `on_auth_user_created` trigger that inserts a
 * `profiles` row (role `owner`, `tenant_id` NULL) on every new auth user. There
 * is no FK cascade from `profiles.auth_user_id` to `auth.users`, so callers must
 * (a) UPSERT the profile keyed on `auth_user_id` (update the trigger-created row)
 * and (b) roll back via `rollbackAuthUser` (which also deletes the orphan profile).
 */

export interface AccountMetadata {
  full_name?: string | null;
  role?: string | null;
  tenant_id?: string | null;
}

/** Base site URL used to build absolute email redirect targets. */
function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:4000"
  );
}

/**
 * Absolute URL the recovery email should return the user to. Routes the Supabase
 * auth code through the existing `/auth/callback` handler, which then forwards to
 * the localized set-password screen (`(auth)/reset-password`).
 */
function buildRedirectTo(locale: string = routing.defaultLocale): string {
  const next = `/${locale}/reset-password`;
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Anon client for public auth flows (no cookies needed for email dispatch). */
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Create a confirmed Supabase auth user with a generated temporary password.
 * Returns the created user plus the plaintext temp password so the caller can
 * display it to the inviting admin. Throws on failure (also surfaces Supabase's
 * own "email already registered" as a fallback duplicate guard) so callers can
 * run their `rollbackAuthUser` cleanup.
 */
export async function createUserAccount({
  email,
  metadata,
}: {
  email: string;
  metadata: AccountMetadata;
}): Promise<{ user: User; tempPassword: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const tempPassword = generateTempPassword();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { ...metadata },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Failed to create user account");
  }

  return { user: data.user, tempPassword };
}

/** Low-level rollback: delete the auth user only. */
export async function deleteAuthUser(userId: string): Promise<void> {
  const supabaseAdmin = createSupabaseServerClient();
  await supabaseAdmin.auth.admin.deleteUser(userId);
}

/**
 * Full rollback for a failed creation: removes the (trigger-created) profile row
 * — there is no FK cascade — and then the auth user, avoiding orphaned records.
 */
export async function rollbackAuthUser(userId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.profiles.deleteMany({ where: { auth_user_id: userId } });
  } catch (error) {
    console.error("Failed to clean up orphaned profile during rollback:", error);
  }
  await deleteAuthUser(userId);
}

/**
 * (Re-)send a set-password / recovery link to an existing user via Supabase's
 * email system. Used by app-owner "email this user" and invite re-sends.
 */
export async function sendSetPasswordLink({
  email,
  locale,
}: {
  email: string;
  locale?: string;
}): Promise<void> {
  const supabase = createAnonClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildRedirectTo(locale),
  });
  if (error) {
    throw new Error(error.message || "Failed to send set-password link");
  }
}
