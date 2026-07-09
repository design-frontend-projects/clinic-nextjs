import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Helper to fetch the current authenticated user's session from cookies (server-side).
 */
export async function getSupabaseSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Supabase session error:", error);
    return null;
  }
  return data.session;
}

/**
 * Retrieve tenant information for the currently logged‑in user. This replaces the
 * legacy Clerk‑based `getTenantInfo` implementation.
 *
 * The function reads the user ID from the Supabase session, then looks up the
 * associated profile and clinic in the Prisma database. All queries are scoped
 * to the tenant using the `tenantId` column – ensure your Prisma models include
 * this field and have RLS policies defined in Supabase.
 */
export async function getTenantInfo() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // Import Prisma client from the shared lib.
  const { prisma } = await import("@/lib/prisma");

  const profile = await prisma.profiles.findFirst({
    where: { auth_user_id: userId }, // Adjust field if you store Supabase user ID elsewhere
    select: {
      id: true,
      role: true,
      full_name: true,
      email: true,
      is_profile_completed: true,
      tenant_id: true,
      is_owner: true,
      status: true,
    },
  });
  if (!profile) return null;

  // Blocked users cannot resolve a tenant context (denies app access).
  if (profile.status === "blocked") return null;

  let tenantId = profile.tenant_id;

  // Self-heal: an invited user (doctor/staff) whose profile.tenant_id was never
  // persisted (e.g. the post-invite upsert didn't complete, so only the
  // `on_auth_user_created` trigger's NULL-tenant row survived) can still be
  // recovered — `user_roles.tenant_id` is stamped with the clinic at invite time.
  // Reconstruct the link and persist it so this is a one-time repair.
  if (!tenantId && !profile.is_owner) {
    const userRole = await prisma.user_roles.findFirst({
      where: { profile_id: profile.id, is_active: true, deleted_at: null },
      select: { tenant_id: true },
    });
    if (userRole?.tenant_id) {
      tenantId = userRole.tenant_id;
      try {
        await prisma.profiles.update({
          where: { id: profile.id },
          data: { tenant_id: tenantId, clinic_id: tenantId },
        });
      } catch {
        // Non-fatal: the read path still succeeds with the recovered tenantId
        // even if persisting the repair fails.
      }
    }
  }

  let clinic = null;
  if (tenantId) {
    clinic = await prisma.clinics.findUnique({
      where: { id: tenantId },
      select: { id: true, subscription_plan: true },
    });
  } else {
    clinic = await prisma.clinics.findFirst({
      where: { auth_user_id: userId, AND: { is_primary: true } },
      select: { id: true, subscription_plan: true },
    });
  }

  // Retrieve branch ID from cookies (if you still store it there).
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const branchId = cookieStore.get("active_branch_id")?.value ?? null;

  return {
    userId,
    orgId: null,
    profileId: profile.id,
    role: profile.role as string,
    fullName: profile.full_name,
    email: profile.email,
    is_profile_completed: profile.is_profile_completed ?? false,
    is_owner: profile.is_owner ?? false,
    clinicId: clinic?.id ?? null,
    subscriptionPlan: clinic?.subscription_plan ?? "free",
    branchId,
    auth_user_id: userId,
  };
}

/**
 * Ensure the user is authenticated and has a valid profile.
 */
export async function requireAuthenticatedTenant() {
  const tenant = await getTenantInfo();
  if (!tenant) {
    throw new Error("Unauthorized: No tenant info found");
  }
  return tenant;
}

/**
 * Ensure the user also has an associated clinic (full tenant context).
 */
export async function requireTenantInfo() {
  const tenant = await getTenantInfo();
  if (!tenant) {
    throw new Error("Unauthorized: No tenant info found");
  }
  if (!tenant.clinicId) {
    throw new Error(
      "Configuration Error: The logged‑in user's profile does not have an assigned clinic_id. Please ensure your profile is linked to a clinic.",
    );
  }
  return {
    ...tenant,
    clinicId: tenant.clinicId,
  };
}

type TenantInfo = NonNullable<Awaited<ReturnType<typeof getTenantInfo>>>;

/**
 * Resolve tenant context for a dashboard layout without throwing.
 *
 * Returns a discriminated result so every role layout can branch consistently:
 * - `unauthenticated`: no session/profile — redirect to sign-in.
 * - `no-clinic`: authenticated but the profile isn't linked to any clinic —
 *   render a friendly notice instead of crashing.
 * - `ok`: full tenant context is available (`clinicId` is guaranteed non-null).
 */
export async function resolveDashboardTenant(): Promise<
  | { status: "unauthenticated" }
  | { status: "no-clinic" }
  | { status: "ok"; tenant: TenantInfo & { clinicId: string } }
> {
  const tenant = await getTenantInfo();
  if (!tenant) return { status: "unauthenticated" };
  if (!tenant.clinicId) return { status: "no-clinic" };
  return { status: "ok", tenant: { ...tenant, clinicId: tenant.clinicId } };
}
