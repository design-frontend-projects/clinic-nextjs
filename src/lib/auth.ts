import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache as reactCache } from "react";
import { isBranchLockedRole, isMultiBranchRole } from "@/types/clinic.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  evaluateTenantAccess,
  type TenantAccessDenied,
} from "@/lib/tenant-access";
import {
  extractActiveRbacRoleNames,
  resolveEffectiveProfileRole,
} from "@/lib/role-resolution";

/**
 * Helper to fetch the current authenticated user from cookies (server-side).
 *
 * Uses `supabase.auth.getUser()`, which authenticates the token by contacting the
 * Supabase Auth server, instead of `getSession()` — the latter returns whatever is
 * in the cookie store without verifying it and is unsafe to trust on the server.
 *
 * The return value is shaped as `{ user }` so callers reading `session.user`
 * continue to work unchanged.
 *
 * Wrapped in React `cache()` so the `getUser()` round-trip to the Supabase Auth
 * server runs at most once per request, even though several call sites (and
 * `getTenantInfo`) invoke it during the same render.
 */
export const getSupabaseSession = reactCache(async () => {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(
    url,
    anonKey,
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

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    // A missing/expired session surfaces here as an AuthSessionMissingError; that
    // is an expected "not signed in" state, not an operational failure to log.
    return null;
  }
  return { user: data.user };
});

/**
 * Retrieve tenant information for the currently logged‑in user. This replaces the
 * legacy Clerk‑based `getTenantInfo` implementation.
 *
 * The function reads the user ID from the Supabase session, then looks up the
 * associated profile and clinic in the Prisma database. All queries are scoped
 * to the tenant using the `tenantId` column – ensure your Prisma models include
 * this field and have RLS policies defined in Supabase.
 *
 * Wrapped in React `cache()` so the profile/clinic/branch lookups run once per
 * request no matter how many actions or layout branches call it during a render.
 */
export const getTenantInfo = reactCache(async () => {
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
      branch_id: true,
      user_roles: {
        where: { is_active: true, deleted_at: null },
        select: {
          tenant_id: true,
          roles: {
            select: {
              name: true,
              is_active: true,
              deleted_at: true,
            },
          },
        },
      },
    },
  });
  if (!profile) return null;

  const effectiveRole = resolveEffectiveProfileRole(
    profile.role,
    extractActiveRbacRoleNames(profile.user_roles),
  );
  const isPlatformAppOwner = effectiveRole === "app_owner";

  let tenantId = isPlatformAppOwner ? null : profile.tenant_id;

  // Self-heal: an invited user (doctor/staff) whose profile.tenant_id was never
  // persisted (e.g. the post-invite upsert didn't complete, so only the
  // `on_auth_user_created` trigger's NULL-tenant row survived) can still be
  // recovered — `user_roles.tenant_id` is stamped with the clinic at invite time.
  // Reconstruct the link and persist it so this is a one-time repair.
  if (!isPlatformAppOwner && !tenantId && !profile.is_owner) {
    let recoveredTenantId =
      profile.user_roles?.find((ur) => ur.tenant_id)?.tenant_id ?? null;
    if (!recoveredTenantId && profile.user_roles === undefined) {
      const userRole = await prisma.user_roles.findFirst({
        where: { profile_id: profile.id, is_active: true, deleted_at: null },
        select: { tenant_id: true },
      });
      recoveredTenantId = userRole?.tenant_id ?? null;
    }
    if (recoveredTenantId) {
      tenantId = recoveredTenantId;
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

  // Doctors can be assigned across multiple clinics/branches (profile_branches).
  // Their active clinic + branch are cookie-driven (like the owner/admin branch
  // switcher) but validated against their assignments; the home clinic
  // (profile.tenant_id) and its primary branch are the defaults on first login.
  // When a doctor has assignment rows the active clinic drives tenant scoping,
  // so it must be resolved BEFORE the clinic lookup below.
  let doctorHasAssignments = false;
  let doctorActiveBranchId: string | null = null;
  if (!isPlatformAppOwner && isMultiBranchRole(effectiveRole)) {
    const assignments = await prisma.profile_branches.findMany({
      where: { profile_id: profile.id },
      select: { clinic_id: true, branch_id: true, is_primary: true },
    });
    if (assignments.length > 0) {
      doctorHasAssignments = true;
      const assignedClinicIds = Array.from(
        new Set(assignments.map((a) => a.clinic_id)),
      );
      const cookieStore = await cookies();

      let activeClinicId = cookieStore.get("active_clinic_id")?.value ?? null;
      if (!activeClinicId || !assignedClinicIds.includes(activeClinicId)) {
        activeClinicId =
          tenantId && assignedClinicIds.includes(tenantId)
            ? tenantId
            : assignedClinicIds[0];
      }
      tenantId = activeClinicId;

      const clinicAssignments = assignments.filter(
        (a) => a.clinic_id === activeClinicId,
      );
      let activeBranchId = cookieStore.get("active_branch_id")?.value ?? null;
      if (
        !activeBranchId ||
        !clinicAssignments.some((a) => a.branch_id === activeBranchId)
      ) {
        const primary =
          clinicAssignments.find((a) => a.is_primary) ?? clinicAssignments[0];
        activeBranchId = primary?.branch_id ?? null;
      }
      doctorActiveBranchId = activeBranchId;
    }
  }

  const clinicSelect = {
    id: true,
    name: true,
    subscription_plan: true,
    status: true,
    request_ref: true,
    activated_at: true,
    rejection_reason: true,
    tenant_subscription: {
      select: {
        status: true,
        payment_status: true,
        start_date: true,
        end_date: true,
        activated_at: true,
        billing_cycle: true,
        price: true,
        grace_period_days: true,
      },
    },
  } as const;

  const baseClinicSelect = {
    id: true,
    name: true,
    subscription_plan: true,
    status: true,
  } as const;

  const queryFullClinic = () =>
    tenantId
      ? prisma.clinics.findUnique({
          where: { id: tenantId },
          select: clinicSelect,
        })
      : prisma.clinics.findFirst({
          where: { auth_user_id: userId, AND: { is_primary: true } },
          select: clinicSelect,
        });

  type ClinicQueryResult = Awaited<ReturnType<typeof queryFullClinic>>;

  const queryBaseClinic = async (): Promise<ClinicQueryResult> => {
    const row = tenantId
      ? await prisma.clinics.findUnique({
          where: { id: tenantId },
          select: baseClinicSelect,
        })
      : await prisma.clinics.findFirst({
          where: { auth_user_id: userId, AND: { is_primary: true } },
          select: baseClinicSelect,
        });
    if (!row) return null;
    return {
      ...row,
      request_ref: null,
      activated_at: null,
      rejection_reason: null,
      tenant_subscription: null,
    };
  };

  let clinic: ClinicQueryResult = null;
  if (!isPlatformAppOwner) {
    try {
      clinic = await queryFullClinic();
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: unknown }).code
          : undefined;
      if (code !== "P2022") {
        throw err;
      }
      console.warn(
        "[auth] Missing columns in DB (P2022) — apply prisma/migrations/27_tenant_approval_and_subscription_gate.sql. Falling back to base clinic columns.",
      );
      clinic = await queryBaseClinic();
    }
  }

  // Branch resolution:
  // - Platform app_owner: no clinic/branch context.
  // - Doctors with assignments: not locked; branch comes from the assignment-
  //   validated active branch resolved above (switchable via the top bar).
  // - Other branch-locked roles (staff/pharmacist/receptionist) and legacy
  //   doctors without assignments are pinned to profiles.branch_id.
  // - Owners/admins keep the cookie-driven switcher behavior.
  const branchLocked =
    !isPlatformAppOwner &&
    !doctorHasAssignments &&
    !(profile.is_owner ?? false) &&
    isBranchLockedRole(effectiveRole);

  let branchId: string | null = null;
  let branchName: string | null = null;

  if (!isPlatformAppOwner) {
    if (doctorHasAssignments) {
      branchId = doctorActiveBranchId;
    } else if (branchLocked) {
      branchId = profile.branch_id ?? null;
    } else {
      const cookieStore = await cookies();
      branchId = cookieStore.get("active_branch_id")?.value ?? null;
    }

    // Validate the resolved branch against the clinic; drop stale/foreign values
    // (e.g. a cookie from another clinic or a branch deleted/unlinked after assignment).
    if (branchId && clinic?.id) {
      const link = await prisma.clinic_branches.findFirst({
        where: { branch_id: branchId, clinic_id: clinic.id },
        select: { branches: { select: { name: true } } },
      });
      if (link) {
        branchName = link.branches.name;
      } else {
        branchId = null;
      }
    } else if (branchId && !clinic?.id) {
      branchId = null;
    }
  }

  const access = evaluateTenantAccess({
    role: effectiveRole,
    profileStatus: profile.status,
    clinic: clinic
      ? {
          status: clinic.status,
          request_ref: clinic.request_ref,
          rejection_reason: clinic.rejection_reason,
          activated_at: clinic.activated_at,
        }
      : null,
    subscription: clinic?.tenant_subscription
      ? {
          status: clinic.tenant_subscription.status,
          payment_status: clinic.tenant_subscription.payment_status,
          start_date: clinic.tenant_subscription.start_date,
          end_date: clinic.tenant_subscription.end_date,
          activated_at: clinic.tenant_subscription.activated_at,
          billing_cycle: clinic.tenant_subscription.billing_cycle,
          price: Number(clinic.tenant_subscription.price),
          grace_period_days: clinic.tenant_subscription.grace_period_days,
        }
      : null,
  });

  return {
    userId,
    orgId: null,
    profileId: profile.id,
    role: effectiveRole,
    fullName: profile.full_name,
    email: profile.email,
    profileStatus: profile.status as string,
    is_profile_completed: profile.is_profile_completed ?? false,
    is_owner: profile.is_owner ?? false,
    clinicId: isPlatformAppOwner ? null : (clinic?.id ?? null),
    clinicName: isPlatformAppOwner ? null : (clinic?.name ?? null),
    clinicStatus: isPlatformAppOwner ? null : (clinic?.status ?? null),
    subscriptionPlan: isPlatformAppOwner
      ? "free"
      : (clinic?.subscription_plan ?? "free"),
    branchId,
    branchName,
    branchLocked,
    auth_user_id: userId,
    access,
  };
});

/**
 * Ensure the user is authenticated and has a valid, non-blocked profile.
 */
export async function requireAuthenticatedTenant() {
  const tenant = await getTenantInfo();
  if (!tenant || tenant.profileStatus === "blocked") {
    throw new Error("Unauthorized: No tenant info found");
  }
  return tenant;
}

/**
 * Ensure the user also has an associated clinic and active/paid/non-expired
 * tenant access.
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
  if (!tenant.access.allowed) {
    throw new Error(`Forbidden: Tenant access denied (${tenant.access.code})`);
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
 * - `blocked`: account/clinic/payment/expiration gate failed — render lockout notice.
 * - `app-owner`: platform operator with no tenant clinic — redirect to /app-owner.
 * - `no-clinic`: authenticated but the profile isn't linked to any clinic —
 *   render a friendly notice instead of crashing.
 * - `ok`: full tenant context is available (`clinicId` is guaranteed non-null).
 */
export async function resolveDashboardTenant(): Promise<
  | { status: "unauthenticated" }
  | { status: "blocked"; access: TenantAccessDenied }
  | { status: "app-owner" }
  | { status: "no-clinic" }
  | { status: "ok"; tenant: TenantInfo & { clinicId: string } }
> {
  const tenant = await getTenantInfo();
  if (!tenant) return { status: "unauthenticated" };
  if (!tenant.access.allowed) {
    return { status: "blocked", access: tenant.access };
  }
  if (tenant.role === "app_owner") return { status: "app-owner" };
  if (!tenant.clinicId) return { status: "no-clinic" };
  return { status: "ok", tenant: { ...tenant, clinicId: tenant.clinicId } };
}
