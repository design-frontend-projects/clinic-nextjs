"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { ClinicStatus, UserStatus } from "@prisma/client";
import {
  createUserAccount,
  rollbackAuthUser,
  sendSetPasswordLink,
} from "@/lib/invitations";
import { syncDoctorSpecialties } from "@/lib/doctor-specialties";
import {
  planToLegacyTier,
  subscriptionWindow,
} from "@/lib/subscription-provisioning";
import {
  fetchTenantAccountSnapshot,
  resolveTenantOwnerAuthId,
} from "@/lib/tenant-subscription-snapshot";
import {
  tenantSubscriptionSchema,
  type TenantOwnerProfileRecord,
  type TenantSubscriptionData,
  type TenantSubscriptionRecord,
} from "@/types/subscription.types";
import {
  createTenantSchema,
  type CreateTenantFormData,
  type CreateTenantResult,
} from "@/types/tenant-creation.types";
import {
  approveTenantRequestSchema,
  rejectTenantRequestSchema,
  type ApproveTenantRequestData,
  type RejectTenantRequestData,
} from "@/types/tenant-request.types";

/**
 * Fetch all tenants (clinics) with their primary owner and owner-scoped subscription.
 */
export async function getTenants() {
  await requireAppOwner();

  const clinics = await prisma.clinics.findMany({
    include: {
      staff_profiles: {
        where: { role: "owner" },
        take: 1,
      },
      _count: {
        select: { staff_profiles: true, patients: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const ownerAuthIds = Array.from(
    new Set(
      clinics
        .map((c) => c.auth_user_id ?? c.staff_profiles[0]?.auth_user_id ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const subscriptions =
    ownerAuthIds.length > 0
      ? await prisma.tenant_subscriptions.findMany({
          where: { tenant_id: { in: ownerAuthIds } },
          include: { plan: true },
        })
      : [];

  const subByOwnerAuthId = new Map(
    subscriptions.map((sub) => [sub.tenant_id, sub]),
  );

  return clinics.map((clinic) => {
    const ownerAuthId =
      clinic.auth_user_id ?? clinic.staff_profiles[0]?.auth_user_id ?? null;
    return {
      ...clinic,
      tenant_subscription: ownerAuthId
        ? (subByOwnerAuthId.get(ownerAuthId) ?? null)
        : null,
    };
  });
}

/**
 * Create a fully provisioned tenant (clinic + owner account) in one step,
 * bypassing the public sign-up / onboarding wizard. Mirrors everything the
 * wizard writes (see src/app/actions/onboarding.ts): clinic, owner profile
 * link, tenant subscription, main branch, optional doctor specialties, and
 * both onboarding-complete flags — so the owner lands straight on /admin.
 *
 * The auth user is created via the Supabase admin API with a temp password
 * (returned once to the app-owner); a set-password email is sent best-effort.
 */
export async function createTenant(
  data: CreateTenantFormData,
): Promise<CreateTenantResult> {
  const admin = await requireAppOwner();
  // requireAppOwner currently also admits clinic owners (role "owner");
  // tenant provisioning uses the Supabase admin API, so gate it strictly.
  if (admin.role !== "app_owner") {
    return { error: "Only the platform app-owner can create tenants." };
  }

  const parsed = createTenantSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid tenant data" };
  }
  const input = parsed.data;
  const ownerEmail = input.owner.email.trim().toLowerCase();

  let plan: Awaited<
    ReturnType<typeof prisma.subscription_plans.findFirst>
  > = null;
  let validSpecialtyIds: string[] = [];
  let duplicateEmail = false;
  try {
    // Global duplicate guard — covers existing tenant owners AND self-service
    // sign-ups that never finished onboarding (profile exists, tenant_id NULL).
    const existingProfile = await prisma.profiles.findFirst({
      where: { email: { equals: ownerEmail, mode: "insensitive" } },
      select: { id: true },
    });
    duplicateEmail = Boolean(existingProfile);

    if (!duplicateEmail) {
      // Resolve the plan before creating anything so a stale selection fails
      // clean; invalid/inactive specialty ids are filtered silently (wizard
      // parity).
      plan = await prisma.subscription_plans.findFirst({
        where: { id: input.plan_id, status: "active", deleted_at: null },
      });
      if (plan && input.specialtyIds.length) {
        validSpecialtyIds = (
          await prisma.specialties.findMany({
            where: { id: { in: input.specialtyIds }, is_active: true },
            select: { id: true },
          })
        ).map((s) => s.id);
      }
    }
  } catch (error) {
    console.error("Tenant creation pre-flight checks failed:", error);
    return { error: "Failed to validate the tenant data. Please try again." };
  }

  if (duplicateEmail) {
    return {
      error:
        "A user with this email already exists (possibly a pending self-service sign-up). Use a different email or manage the existing account.",
    };
  }
  if (!plan) {
    return { error: "Selected plan is not available." };
  }
  // Const capture so the narrowed type carries into the transaction closure.
  const activePlan = plan;

  // Auth user first, outside the DB transaction. No tenant_id in the metadata
  // — the clinic doesn't exist yet, so the on_auth_user_created trigger
  // creates an unlinked owner profile we update below.
  let authUserId: string;
  let tempPassword: string;
  try {
    const created = await createUserAccount({
      email: ownerEmail,
      metadata: { full_name: input.owner.full_name, role: "owner" },
    });
    authUserId = created.user.id;
    tempPassword = created.tempPassword;
  } catch (error) {
    // Also surfaces Supabase's "email already registered" for auth-only orphans.
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create the owner account",
    };
  }

  let provisioned: {
    clinicId: string;
    subscription: TenantSubscriptionRecord;
    profile: TenantOwnerProfileRecord;
  };
  try {
    provisioned = await prisma.$transaction(async (tx) => {
      const now = new Date();

      const clinic = await tx.clinics.create({
        data: {
          auth_user_id: authUserId,
          is_primary: true,
          name: input.clinic.name,
          registration_number: input.clinic.registration_number || null,
          email: input.clinic.email || null,
          phone: input.clinic.phone || null,
          subscription_plan: planToLegacyTier(activePlan),
          // Schema default is "trial"; admin-created tenants start active.
          status: ClinicStatus.active,
          activated_at: now,
          reviewed_by: admin.id,
          reviewed_at: now,
          onboarding_completed_at: now,
        },
      });

      // The on_auth_user_created trigger pre-created this row; the create
      // branch only covers environments where the trigger is disabled.
      const ownerProfileData = {
        tenant_id: clinic.id,
        clinic_id: clinic.id,
        full_name: input.owner.full_name,
        email: ownerEmail,
        phone: input.owner.phone || null,
        role: "owner" as const,
        is_owner: true,
        status: UserStatus.active,
        is_profile_completed: true,
      };
      const ownerProfile = await tx.profiles.upsert({
        where: { auth_user_id: authUserId },
        update: ownerProfileData,
        create: { auth_user_id: authUserId, ...ownerProfileData },
      });

      const { startDate, endDate } = subscriptionWindow(
        activePlan.billing_period,
      );
      await tx.tenant_subscriptions.create({
        data: {
          tenant_id: authUserId,
          plan_id: activePlan.id,
          start_date: startDate,
          end_date: endDate,
          renewal_date: endDate,
          activated_at: now,
          grace_period_days: 7,
          status: "active",
          billing_cycle: activePlan.billing_period,
          price: activePlan.price,
          currency: activePlan.currency,
          payment_status: "paid",
          created_by: admin.id,
        },
      });

      const mainBranch = await tx.branches.create({
        data: {
          owner_id: authUserId,
          clinic_id: clinic.id,
          name: input.branch.name || "Main Branch",
          address: input.branch.address || null,
          phone: input.branch.phone || null,
          status: "active",
        },
      });

      await tx.clinic_branches.create({
        data: {
          clinic_id: clinic.id,
          branch_id: mainBranch.id,
          is_primary: true,
        },
      });

      if (validSpecialtyIds.length > 0) {
        await syncDoctorSpecialties(tx, ownerProfile.id, validSpecialtyIds);
      }

      await tx.audit_logs.create({
        data: {
          tenant_id: clinic.id,
          actor_id: admin.id,
          actor_email: admin.email,
          action: "TENANT_CREATED",
          entity_type: "clinics",
          entity_id: clinic.id,
          new_values: {
            name: clinic.name,
            plan_id: activePlan.id,
            owner_email: ownerEmail,
          },
        },
      });

      const snapshot = await fetchTenantAccountSnapshot(tx, authUserId);
      if (!snapshot.subscription) {
        throw new Error("Created tenant subscription could not be loaded.");
      }

      return {
        clinicId: clinic.id,
        subscription: snapshot.subscription,
        profile: snapshot.profile,
      };
    });
  } catch (error) {
    console.error("Tenant provisioning failed, rolling back auth user:", error);
    try {
      await rollbackAuthUser(authUserId);
    } catch (rollbackError) {
      console.error(
        `Rollback failed — orphan auth user ${authUserId}:`,
        rollbackError,
      );
    }
    return { error: "Failed to provision the tenant. All changes were rolled back." };
  }

  // Best-effort credential email — the tenant is already provisioned, so a
  // delivery failure only downgrades the handoff to the temp password.
  let emailSent = true;
  try {
    await sendSetPasswordLink({ email: ownerEmail, locale: await getLocale() });
  } catch (error) {
    console.error("Set-password email failed (tenant already created):", error);
    emailSent = false;
  }

  revalidatePath("/app-owner/tenants");
  return {
    success: true,
    tenantId: provisioned.clinicId,
    tempPassword,
    ownerEmail,
    ownerName: input.owner.full_name,
    emailSent,
    subscription: provisioned.subscription,
    profile: provisioned.profile,
  };
}

/**
 * Suspend a tenant, blocking all of its users from accessing the application.
 */
export async function suspendTenant(tenantId: string) {
  const admin = await requireAppOwner();

  await prisma.clinics.update({
    where: { id: tenantId },
    data: { status: ClinicStatus.suspended },
  });

  // Log action
  await prisma.audit_logs.create({
    data: {
      tenant_id: tenantId,
      actor_id: admin.id,
      action: "TENANT_SUSPENDED",
      new_values: {},
    },
  });

  revalidatePath("/app-owner/tenants");
  return { success: true };
}

/**
 * Reactivate a suspended tenant.
 */
export async function activateTenant(tenantId: string) {
  const admin = await requireAppOwner();

  await prisma.clinics.update({
    where: { id: tenantId },
    data: { status: ClinicStatus.active },
  });

  await prisma.audit_logs.create({
    data: {
      tenant_id: tenantId,
      actor_id: admin.id,
      action: "TENANT_ACTIVATED",
      new_values: {},
    },
  });

  revalidatePath("/app-owner/tenants");
  return { success: true };
}

/**
 * Block a single user (owner/admin) from accessing the application.
 */
export async function blockUser(profileId: string) {
  const admin = await requireAppOwner();

  const profile = await prisma.profiles.update({
    where: { id: profileId },
    data: { status: UserStatus.blocked },
    select: { id: true, tenant_id: true, email: true },
  });

  if (profile.tenant_id) {
    await prisma.audit_logs.create({
      data: {
        tenant_id: profile.tenant_id,
        actor_id: admin.id,
        action: "USER_BLOCKED",
        entity_type: "profiles",
        entity_id: profile.id,
        new_values: {},
      },
    });
  }

  revalidatePath("/app-owner/tenants");
  return { success: true };
}

/**
 * Unblock a previously blocked user.
 */
export async function unblockUser(profileId: string) {
  const admin = await requireAppOwner();

  const profile = await prisma.profiles.update({
    where: { id: profileId },
    data: { status: UserStatus.active },
    select: { id: true, tenant_id: true },
  });

  if (profile.tenant_id) {
    await prisma.audit_logs.create({
      data: {
        tenant_id: profile.tenant_id,
        actor_id: admin.id,
        action: "USER_UNBLOCKED",
        entity_type: "profiles",
        entity_id: profile.id,
        new_values: {},
      },
    });
  }

  revalidatePath("/app-owner/tenants");
  return { success: true };
}

/**
 * Email a user a set-password / recovery link via Supabase.
 */
export async function emailUser(profileId: string) {
  await requireAppOwner();

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { email: true },
  });

  if (!profile?.email) {
    return { error: "This user has no email address on file." };
  }

  try {
    await sendSetPasswordLink({ email: profile.email });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to send email.",
    };
  }

  return { success: true };
}

/**
 * Assign or change a tenant's subscription plan (typed, drawer-facing).
 */
export async function assignTenantPlan(data: TenantSubscriptionData) {
  const admin = await requireAppOwner();

  const parsed = tenantSubscriptionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid subscription data" };
  }
  const input = parsed.data;

  const resolvedOwner = await resolveTenantOwnerAuthId(prisma, input.tenant_id);
  if (!resolvedOwner) {
    return {
      error: "Tenant must have a primary owner before assigning a subscription.",
    };
  }
  const ownerAuthUserId = resolvedOwner.ownerAuthUserId;

  const existing = await prisma.tenant_subscriptions.findUnique({
    where: { tenant_id: ownerAuthUserId },
  });

  const now = new Date();
  const startDate = input.start_date
    ? new Date(input.start_date)
    : existing?.start_date ?? now;
  const computedEndDate =
    input.billing_cycle === "lifetime"
      ? null
      : input.end_date
        ? new Date(input.end_date)
        : existing?.end_date && !input.start_date
          ? existing.end_date
          : subscriptionWindow(input.billing_cycle, startDate).endDate;

  if (
    Number.isNaN(startDate.getTime()) ||
    (computedEndDate && Number.isNaN(computedEndDate.getTime()))
  ) {
    return { error: "Invalid subscription start or end date." };
  }
  if (computedEndDate && computedEndDate.getTime() < startDate.getTime()) {
    return { error: "End date must be on or after the start date." };
  }

  const nextPaymentStatus =
    input.payment_status ?? existing?.payment_status ?? "pending";
  const nextPaymentRef =
    input.payment_reference !== undefined
      ? input.payment_reference || null
      : existing?.payment_reference ?? null;
  const nextGraceDays =
    input.grace_period_days ?? existing?.grace_period_days ?? 7;

  const subscription = existing
    ? await prisma.tenant_subscriptions.update({
        where: { tenant_id: ownerAuthUserId },
        data: {
          plan_id: input.plan_id,
          status: input.status,
          start_date: startDate,
          end_date: computedEndDate,
          renewal_date: computedEndDate,
          activated_at: existing.activated_at ?? now,
          grace_period_days: nextGraceDays,
          price: input.price,
          discount: input.discount ?? null,
          currency: input.currency,
          billing_cycle: input.billing_cycle,
          payment_status: nextPaymentStatus,
          payment_reference: nextPaymentRef,
          notes: input.notes ?? null,
          updated_by: admin.id,
        },
      })
    : await prisma.tenant_subscriptions.create({
        data: {
          tenant_id: ownerAuthUserId,
          plan_id: input.plan_id,
          status: input.status,
          start_date: startDate,
          end_date: computedEndDate,
          renewal_date: computedEndDate,
          activated_at: now,
          grace_period_days: nextGraceDays,
          price: input.price,
          discount: input.discount ?? null,
          currency: input.currency,
          billing_cycle: input.billing_cycle,
          payment_status: nextPaymentStatus,
          payment_reference: nextPaymentRef,
          notes: input.notes ?? null,
          created_by: admin.id,
        },
      });

  const assignedPlan = await prisma.subscription_plans.findFirst({
    where: { id: input.plan_id, deleted_at: null },
    select: { name: true, price: true },
  });
  if (assignedPlan) {
    await prisma.clinics.updateMany({
      where: { auth_user_id: ownerAuthUserId },
      data: { subscription_plan: planToLegacyTier(assignedPlan) },
    });
  }

  const transitionedToPaid =
    nextPaymentStatus === "paid" &&
    (!existing ||
      existing.payment_status !== "paid" ||
      (Boolean(input.payment_reference) &&
        input.payment_reference !== existing.payment_reference));

  if (transitionedToPaid) {
    await prisma.payment_records.create({
      data: {
        tenant_subscription_id: subscription.id,
        amount: Math.max(0, Number(input.price) - Number(input.discount ?? 0)),
        currency: input.currency,
        status: "paid",
        payment_date: now,
        reference: nextPaymentRef,
        notes: input.notes ?? null,
      },
    });
  }

  await prisma.tenant_subscription_history.create({
    data: {
      tenant_subscription_id: subscription.id,
      action: existing ? "UPDATED" : "CREATED",
      new_data: {
        plan_id: input.plan_id,
        status: input.status,
        payment_status: nextPaymentStatus,
        start_date: startDate.toISOString(),
        end_date: computedEndDate?.toISOString() ?? null,
      },
      changed_by: admin.id,
    },
  });

  const snapshot = await fetchTenantAccountSnapshot(prisma, ownerAuthUserId);

  revalidatePath("/app-owner/tenants");
  revalidatePath("/app-owner");
  return {
    success: true as const,
    subscription: snapshot.subscription,
    profile: snapshot.profile,
  };
}

/**
 * Approve an `under_review` (or previously `rejected`) tenant request:
 * activates the clinic + owner profile, ensures a default Main Branch exists,
 * configures the subscription window/payment/grace period, records payment if
 * paid, and logs audit/subscription history atomically.
 */
export async function approveTenantRequest(
  data: ApproveTenantRequestData,
): Promise<
  | {
      success: true;
      subscription: TenantSubscriptionRecord | null;
      profile: TenantOwnerProfileRecord;
    }
  | { error: string }
> {
  const admin = await requireAppOwner();
  if (admin.role !== "app_owner") {
    return { error: "Only the platform app-owner can approve tenant requests." };
  }

  const parsed = approveTenantRequestSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid approval data" };
  }
  const input = parsed.data;

  const [clinic, plan] = await Promise.all([
    prisma.clinics.findUnique({
      where: { id: input.tenantId },
      include: {
        staff_profiles: {
          where: { role: "owner" },
          select: { id: true, email: true, auth_user_id: true },
          take: 1,
        },
      },
    }),
    prisma.subscription_plans.findFirst({
      where: { id: input.planId, deleted_at: null },
    }),
  ]);

  if (!clinic) {
    return { error: "Tenant request not found." };
  }
  if (
    clinic.status !== ClinicStatus.under_review &&
    clinic.status !== ClinicStatus.rejected
  ) {
    return {
      error: "Only requests that are under review or rejected can be approved.",
    };
  }
  if (!plan) {
    return { error: "Selected subscription plan was not found." };
  }

  const owner = clinic.staff_profiles[0];
  if (!owner) {
    return { error: "Tenant must have a primary owner profile to approve." };
  }

  const ownerAuthUserId = clinic.auth_user_id ?? owner.auth_user_id;
  if (!ownerAuthUserId) {
    return { error: "Tenant must have a primary owner account to approve." };
  }

  const startDate = new Date(input.startDate);
  if (Number.isNaN(startDate.getTime())) {
    return { error: "Invalid start date." };
  }

  const endDate =
    input.billingCycle === "lifetime"
      ? null
      : input.endDate
        ? new Date(input.endDate)
        : subscriptionWindow(input.billingCycle, startDate).endDate;

  if (endDate && Number.isNaN(endDate.getTime())) {
    return { error: "Invalid end date." };
  }
  if (endDate && endDate.getTime() < startDate.getTime()) {
    return { error: "End date must be on or after the start date." };
  }

  let snapshot: {
    subscription: TenantSubscriptionRecord | null;
    profile: TenantOwnerProfileRecord;
  };
  try {
    snapshot = await prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.clinics.update({
        where: { id: clinic.id },
        data: {
          status:
            input.clinicStatus === "trial"
              ? ClinicStatus.trial
              : ClinicStatus.active,
          activated_at: now,
          reviewed_by: admin.id,
          reviewed_at: now,
          rejection_reason: null,
          onboarding_completed_at: clinic.onboarding_completed_at ?? now,
          subscription_plan: planToLegacyTier(plan),
        },
      });

      await tx.profiles.update({
        where: { id: owner.id },
        data: {
          status: UserStatus.active,
          is_profile_completed: true,
        },
      });

      const branchCount = await tx.clinic_branches.count({
        where: { clinic_id: clinic.id },
      });
      if (branchCount === 0) {
        const mainBranch = await tx.branches.create({
          data: {
            owner_id: ownerAuthUserId,
            clinic_id: clinic.id,
            name: "Main Branch",
            status: "active",
          },
        });
        await tx.clinic_branches.create({
          data: {
            clinic_id: clinic.id,
            branch_id: mainBranch.id,
            is_primary: true,
          },
        });
      }

      const subscription = await tx.tenant_subscriptions.upsert({
        where: { tenant_id: ownerAuthUserId },
        update: {
          plan_id: plan.id,
          status: "active",
          start_date: startDate,
          end_date: endDate,
          renewal_date: endDate,
          activated_at: now,
          billing_cycle: input.billingCycle,
          price: input.price,
          discount: input.discount ?? null,
          currency: input.currency,
          payment_status: input.paymentStatus,
          payment_reference: input.paymentReference || null,
          grace_period_days: input.gracePeriodDays,
          notes: input.notes || null,
          updated_by: admin.id,
        },
        create: {
          tenant_id: ownerAuthUserId,
          plan_id: plan.id,
          status: "active",
          start_date: startDate,
          end_date: endDate,
          renewal_date: endDate,
          activated_at: now,
          billing_cycle: input.billingCycle,
          price: input.price,
          discount: input.discount ?? null,
          currency: input.currency,
          payment_status: input.paymentStatus,
          payment_reference: input.paymentReference || null,
          grace_period_days: input.gracePeriodDays,
          notes: input.notes || null,
          created_by: admin.id,
        },
      });

      if (input.paymentStatus === "paid") {
        await tx.payment_records.create({
          data: {
            tenant_subscription_id: subscription.id,
            amount: Math.max(0, Number(input.price) - Number(input.discount ?? 0)),
            currency: input.currency,
            status: "paid",
            payment_date: now,
            reference: input.paymentReference || null,
            notes: input.notes || null,
          },
        });
      }

      await tx.tenant_subscription_history.create({
        data: {
          tenant_subscription_id: subscription.id,
          action: "APPROVED",
          new_data: {
            plan_id: plan.id,
            clinic_status: input.clinicStatus,
            payment_status: input.paymentStatus,
            start_date: startDate.toISOString(),
            end_date: endDate?.toISOString() ?? null,
            grace_period_days: input.gracePeriodDays,
          },
          changed_by: admin.id,
        },
      });

      await tx.audit_logs.create({
        data: {
          tenant_id: clinic.id,
          actor_id: admin.id,
          actor_email: admin.email,
          action: "TENANT_REQUEST_APPROVED",
          entity_type: "clinics",
          entity_id: clinic.id,
          new_values: {
            request_ref: clinic.request_ref,
            clinic_status: input.clinicStatus,
            plan_id: plan.id,
            payment_status: input.paymentStatus,
          },
        },
      });

      return await fetchTenantAccountSnapshot(tx, ownerAuthUserId);
    });
  } catch (error) {
    console.error("approveTenantRequest failed:", error);
    return { error: "Failed to approve tenant request." };
  }

  revalidatePath("/app-owner/tenants");
  revalidatePath("/app-owner");
  return {
    success: true,
    subscription: snapshot.subscription,
    profile: snapshot.profile,
  };
}

/**
 * Reject an `under_review` tenant request with an optional reason.
 */
export async function rejectTenantRequest(
  data: RejectTenantRequestData,
): Promise<
  | {
      success: true;
      subscription: TenantSubscriptionRecord | null;
      profile: TenantOwnerProfileRecord | null;
    }
  | { error: string }
> {
  const admin = await requireAppOwner();
  if (admin.role !== "app_owner") {
    return { error: "Only the platform app-owner can reject tenant requests." };
  }

  const parsed = rejectTenantRequestSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid rejection data" };
  }
  const input = parsed.data;

  const clinic = await prisma.clinics.findUnique({
    where: { id: input.tenantId },
    select: {
      id: true,
      status: true,
      request_ref: true,
      auth_user_id: true,
      staff_profiles: {
        where: { role: "owner" },
        select: { auth_user_id: true },
        take: 1,
      },
    },
  });

  if (!clinic) {
    return { error: "Tenant request not found." };
  }
  if (clinic.status !== ClinicStatus.under_review) {
    return { error: "Only requests currently under review can be rejected." };
  }

  const ownerAuthUserId =
    clinic.auth_user_id ?? clinic.staff_profiles?.[0]?.auth_user_id ?? null;

  let snapshot: {
    subscription: TenantSubscriptionRecord | null;
    profile: TenantOwnerProfileRecord | null;
  } = { subscription: null, profile: null };
  try {
    snapshot = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const reason = input.reason?.trim() || null;

      await tx.clinics.update({
        where: { id: clinic.id },
        data: {
          status: ClinicStatus.rejected,
          reviewed_by: admin.id,
          reviewed_at: now,
          rejection_reason: reason,
        },
      });

      if (ownerAuthUserId) {
        await tx.tenant_subscriptions.updateMany({
          where: { tenant_id: ownerAuthUserId },
          data: {
            status: "cancelled",
            updated_by: admin.id,
          },
        });
      }

      await tx.audit_logs.create({
        data: {
          tenant_id: clinic.id,
          actor_id: admin.id,
          actor_email: admin.email,
          action: "TENANT_REQUEST_REJECTED",
          entity_type: "clinics",
          entity_id: clinic.id,
          new_values: {
            request_ref: clinic.request_ref,
            reason,
          },
        },
      });

      if (!ownerAuthUserId) {
        return { subscription: null, profile: null };
      }
      return await fetchTenantAccountSnapshot(tx, ownerAuthUserId);
    });
  } catch (error) {
    console.error("rejectTenantRequest failed:", error);
    return { error: "Failed to reject tenant request." };
  }

  revalidatePath("/app-owner/tenants");
  revalidatePath("/app-owner");
  return {
    success: true,
    subscription: snapshot.subscription,
    profile: snapshot.profile,
  };
}
