"use server";

import { randomUUID } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ClinicStatus, UserStatus } from "@prisma/client";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { getSupabaseSession, getTenantInfo } from "@/lib/auth";
import { isSecureCookieContext } from "@/lib/cookie-options";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { roleHomePath, DEFAULT_HOME_PATH } from "@/lib/role-routes";
import { createUserAccountWithPassword, rollbackAuthUser } from "@/lib/invitations";
import { planToLegacyTier } from "@/lib/subscription-provisioning";
import { formatRequestRef } from "@/lib/tenant-access";
import {
  checkRequestStatusSchema,
  tenantRequestSchema,
  type CheckRequestStatusData,
  type CompleteSignInResult,
  type RequestTenantAccountResult,
  type TenantRequestFormData,
  type TenantRequestStatusResult,
} from "@/types/tenant-request.types";

async function setOnboardingCookieIfEligible(
  tenant: Awaited<ReturnType<typeof getTenantInfo>>,
): Promise<void> {
  if (!tenant?.clinicId) return;
  if (tenant.is_owner && !tenant.is_profile_completed) return;

  const cookieStore = await cookies();
  const secure = await isSecureCookieContext();
  cookieStore.set("onboarding_complete", "1", {
    httpOnly: true,
    secure,
    path: "/",
    sameSite: "lax",
  });
}

async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("onboarding_complete");
  cookieStore.delete("active_clinic_id");
  cookieStore.delete("active_branch_id");
}

async function signOutServerSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignored in Server Action
          }
        },
      },
    });
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[auth] signOutServerSession failed:", error);
  }
}

async function resolveFallbackRedirectPath(): Promise<string> {
  try {
    const session = await getSupabaseSession();
    const roles = session?.user?.app_metadata?.roles as string[] | undefined;
    const jwtRole = roles?.find((r) => roleHomePath(r) !== DEFAULT_HOME_PATH);
    return jwtRole ? roleHomePath(jwtRole) : DEFAULT_HOME_PATH;
  } catch (error) {
    console.error(
      "[auth] getPostSignInRedirect: getSupabaseSession fallback failed:",
      error,
    );
    return DEFAULT_HOME_PATH;
  }
}

/**
 * Single post-sign-in server action combining tenant access verification
 * (account/clinic status, payment status, subscription dates + grace period),
 * onboarding cookie sync, and authoritative role-based landing route
 * resolution in ONE `getTenantInfo()` round-trip.
 */
export async function completeSignIn(): Promise<CompleteSignInResult> {
  try {
    const tenant = await getTenantInfo();
    if (tenant) {
      if (tenant.access && !tenant.access.allowed) {
        await signOutServerSession();
        await clearSessionCookies();
        return { blocked: true, access: tenant.access };
      }

      await setOnboardingCookieIfEligible(tenant);
      return { blocked: false, redirectPath: roleHomePath(tenant.role) };
    }
  } catch (error) {
    console.error(
      "[auth] completeSignIn: getTenantInfo failed, falling back to JWT role:",
      error,
    );
  }

  return { blocked: false, redirectPath: await resolveFallbackRedirectPath() };
}

/**
 * Clear tenant/onboarding cookies on explicit sign-out so a subsequent user on
 * the same browser never inherits the previous user's clinic/branch/onboarding
 * state.
 */
export async function clearSignOutCookies(): Promise<void> {
  try {
    await clearSessionCookies();
  } catch (error) {
    console.error("[auth] clearSignOutCookies failed:", error);
  }
}

/**
 * After a successful sign-in, mark onboarding as complete for users who
 * already belong to a clinic.
 */
export async function syncOnboardingCookie() {
  try {
    const tenant = await getTenantInfo();
    if (tenant?.access && !tenant.access.allowed) {
      return;
    }
    await setOnboardingCookieIfEligible(tenant);
  } catch (error) {
    console.error("[auth] syncOnboardingCookie failed:", error);
  }
}

/**
 * Resolve the dashboard landing path for the just-signed-in user from their
 * authoritative `profiles.role`.
 */
export async function getPostSignInRedirect(): Promise<string> {
  try {
    const tenant = await getTenantInfo();
    if (tenant) {
      return roleHomePath(tenant.role);
    }
  } catch (error) {
    console.error(
      "[auth] getPostSignInRedirect: getTenantInfo failed, falling back to JWT role:",
      error,
    );
  }

  return resolveFallbackRedirectPath();
}

/**
 * Submit a new self-service tenant account request.
 * Creates the Supabase Auth user with the applicant's chosen password (without
 * establishing a browser session), provisions the clinic in `under_review`
 * status with a unique sequential reference number (`REQ-YYYY-NNNN`), creates
 * an `inactive` owner profile and `pending_approval` subscription, and alerts
 * all active `app_owner` users via in-app notifications.
 */
export async function requestTenantAccountAction(
  data: TenantRequestFormData,
): Promise<RequestTenantAccountResult> {
  try {
    const parsed = tenantRequestSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Validation error" };
    }
    const input = parsed.data;
    const normalizedEmail = input.email.trim().toLowerCase();

    const [existingProfile, plan] = await Promise.all([
      prisma.profiles.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true },
      }),
      prisma.subscription_plans.findFirst({
        where: { id: input.planId, status: "active", deleted_at: null },
      }),
    ]);

    if (existingProfile) {
      return {
        error:
          "An account or request with this email already exists. Use Track Request Status or Sign In.",
      };
    }

    if (!plan) {
      return { error: "Selected subscription plan is not available." };
    }

    let authUserId: string;
    try {
      const created = await createUserAccountWithPassword({
        email: normalizedEmail,
        password: input.password,
        metadata: { full_name: input.fullName, role: "owner" },
      });
      authUserId = created.user.id;
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create account request.",
      };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const seqRows = await tx.$queryRaw<Array<{ nextval: bigint | number }>>`
          SELECT nextval('public.tenant_request_ref_seq') AS nextval
        `;
        const seqValue = seqRows[0]?.nextval ?? Date.now();
        const requestRef = formatRequestRef(seqValue, now.getUTCFullYear());

        const clinic = await tx.clinics.create({
          data: {
            auth_user_id: authUserId,
            is_primary: true,
            name: input.clinicName,
            registration_number: input.registrationNumber || null,
            email: input.clinicEmail || null,
            phone: input.clinicPhone || null,
            subscription_plan: planToLegacyTier(plan),
            status: ClinicStatus.under_review,
            request_ref: requestRef,
          },
        });

        const ownerProfileData = {
          tenant_id: clinic.id,
          clinic_id: clinic.id,
          full_name: input.fullName,
          email: normalizedEmail,
          phone: input.phone,
          role: "owner" as const,
          is_owner: true,
          status: UserStatus.inactive,
          is_profile_completed: false,
        };

        const ownerProfile = await tx.profiles.upsert({
          where: { auth_user_id: authUserId },
          update: ownerProfileData,
          create: { auth_user_id: authUserId, ...ownerProfileData },
        });

        await tx.tenant_subscriptions.create({
          data: {
            tenant_id: clinic.id,
            plan_id: plan.id,
            start_date: now,
            end_date: null,
            renewal_date: null,
            status: "pending_approval",
            billing_cycle: plan.billing_period,
            price: plan.price,
            currency: plan.currency,
            payment_status: "pending",
            grace_period_days: 7,
          },
        });

        await tx.audit_logs.create({
          data: {
            tenant_id: clinic.id,
            actor_id: ownerProfile.id,
            actor_email: normalizedEmail,
            action: "TENANT_REQUEST_SUBMITTED",
            entity_type: "clinics",
            entity_id: clinic.id,
            new_values: {
              request_ref: requestRef,
              clinic_name: clinic.name,
              owner_email: normalizedEmail,
              plan_id: plan.id,
            },
          },
        });

        const appOwners = await tx.profiles.findMany({
          where: { role: "app_owner", status: UserStatus.active },
          select: { id: true },
        });

        if (appOwners.length > 0) {
          const groupId = randomUUID();
          await tx.notifications.createMany({
            data: appOwners.map((owner) => ({
              tenant_id: clinic.id,
              group_id: groupId,
              sender_id: ownerProfile.id,
              sender_role: "owner",
              sender_name: input.fullName,
              recipient_id: owner.id,
              recipient_role: "app_owner",
              title: "New tenant account request",
              body: `${input.clinicName} (${requestRef}) requested the ${plan.name} plan and is awaiting review.`,
              category: "system",
              priority: "high",
              deep_link: "/app-owner/tenants?tab=requests",
              delivered_at: now,
              created_by: ownerProfile.id,
            })),
            skipDuplicates: true,
          });
        }

        return { requestRef, clinicName: clinic.name };
      });

      return {
        success: true,
        requestRef: result.requestRef,
        clinicName: result.clinicName,
        email: normalizedEmail,
      };
    } catch (error) {
      console.error("Tenant request transaction failed, rolling back:", error);
      try {
        await rollbackAuthUser(authUserId);
      } catch (rollbackError) {
        console.error(
          `Rollback failed — orphan auth user ${authUserId}:`,
          rollbackError,
        );
      }
      return {
        error: "Failed to submit account request. Please try again.",
      };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation error" };
    }
    console.error("Request tenant account error:", error);
    return {
      error: "An unexpected error occurred while submitting your request.",
    };
  }
}

/**
 * Public status lookup by reference number + owner email.
 * Requires both fields to match so external callers cannot enumerate clinics.
 */
export async function checkTenantRequestStatusAction(
  data: CheckRequestStatusData,
): Promise<TenantRequestStatusResult> {
  try {
    const parsed = checkRequestStatusSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const normalizedRef = parsed.data.requestRef.trim().toUpperCase();
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    const clinic = await prisma.clinics.findFirst({
      where: {
        request_ref: { equals: normalizedRef, mode: "insensitive" },
      },
      include: {
        staff_profiles: {
          where: { role: "owner" },
          select: { email: true },
          take: 1,
        },
        tenant_subscription: {
          include: {
            plan: { select: { name: true } },
          },
        },
      },
    });

    const ownerEmail = clinic?.staff_profiles[0]?.email?.trim().toLowerCase();
    if (!clinic || !ownerEmail || ownerEmail !== normalizedEmail) {
      return {
        error:
          "No matching request found for that reference number and email.",
      };
    }

    return {
      success: true,
      request: {
        requestRef: clinic.request_ref ?? normalizedRef,
        clinicName: clinic.name,
        status: clinic.status,
        planName: clinic.tenant_subscription?.plan?.name ?? null,
        submittedAt: clinic.created_at.toISOString(),
        reviewedAt: clinic.reviewed_at?.toISOString() ?? null,
        rejectionReason: clinic.rejection_reason ?? null,
        paymentStatus: clinic.tenant_subscription?.payment_status ?? null,
        startDate:
          clinic.tenant_subscription?.start_date?.toISOString() ?? null,
        endDate: clinic.tenant_subscription?.end_date?.toISOString() ?? null,
      },
    };
  } catch (error) {
    console.error("checkTenantRequestStatusAction error:", error);
    return { error: "Unable to check request status right now." };
  }
}
