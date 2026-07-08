import { createClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

/**
 * Credential-delivery helpers built on Supabase's own email system.
 *
 * New users are created + emailed a set-password invite in a single call via
 * `auth.admin.inviteUserByEmail`. Existing users are (re-)sent a recovery link
 * via `auth.resetPasswordForEmail`. Both rely on the Supabase project having
 * SMTP configured (dashboard setting) for delivery to actually happen.
 */

export interface InviteMetadata {
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
 * Absolute URL the invite/recovery email should return the user to. Routes the
 * Supabase auth code through the existing `/auth/callback` handler, which then
 * forwards to the localized set-password screen (`(auth)/reset-password`).
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
 * Create a Supabase auth user and email them an invitation to set their
 * password. Returns the created auth user. Throws on failure so callers can run
 * their existing profile/patient rollback (delete the auth user) in a catch.
 */
export async function inviteUser({
  email,
  metadata,
  locale,
}: {
  email: string;
  metadata: InviteMetadata;
  locale?: string;
}): Promise<User> {
  const supabaseAdmin = createSupabaseServerClient();

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      data: metadata,
      redirectTo: buildRedirectTo(locale),
    },
  );

  if (error || !data.user) {
    throw new Error(error?.message || "Failed to send invitation");
  }

  return data.user;
}

/**
 * Roll back an invited auth user (used by callers when the subsequent DB writes
 * fail, to avoid orphaned auth accounts).
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const supabaseAdmin = createSupabaseServerClient();
  await supabaseAdmin.auth.admin.deleteUser(userId);
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
