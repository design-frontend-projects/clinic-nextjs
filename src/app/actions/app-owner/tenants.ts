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
  tenantSubscriptionSchema,
  type TenantSubscriptionData,
} from "@/types/subscription.types";
import {
  createTenantSchema,
  type CreateTenantFormData,
  type CreateTenantResult,
} from "@/types/tenant-creation.types";

/**
 * Fetch all tenants (clinics) with their primary owner and subscription.
 */
export async function getTenants() {
  await requireAppOwner();

  return await prisma.clinics.findMany({
    include: {
      tenant_subscription: {
        include: {
          plan: true,
        },
      },
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

  let tenantId: string;
  try {
    tenantId = await prisma.$transaction(async (tx) => {
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
          tenant_id: clinic.id,
          plan_id: activePlan.id,
          start_date: startDate,
          end_date: endDate,
          renewal_date: endDate,
          status: "active",
          billing_cycle: activePlan.billing_period,
          price: activePlan.price,
          currency: activePlan.currency,
          created_by: admin.id,
        },
      });

      await tx.branches.create({
        data: {
          clinic_id: clinic.id,
          name: input.branch.name || "Main Branch",
          address: input.branch.address || null,
          phone: input.branch.phone || null,
          status: "active",
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

      return clinic.id;
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
    tenantId,
    tempPassword,
    ownerEmail,
    ownerName: input.owner.full_name,
    emailSent,
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

  const owner = await prisma.profiles.findFirst({
    where: { tenant_id: input.tenant_id, role: "owner" },
    select: { id: true },
  });
  if (!owner) {
    return {
      error: "Tenant must have a primary owner before assigning a subscription.",
    };
  }

  const existing = await prisma.tenant_subscriptions.findUnique({
    where: { tenant_id: input.tenant_id },
  });

  const subscription = existing
    ? await prisma.tenant_subscriptions.update({
        where: { tenant_id: input.tenant_id },
        data: {
          plan_id: input.plan_id,
          status: input.status,
          price: input.price,
          discount: input.discount ?? null,
          currency: input.currency,
          billing_cycle: input.billing_cycle,
          notes: input.notes ?? null,
          updated_by: admin.id,
        },
      })
    : await prisma.tenant_subscriptions.create({
        data: {
          tenant_id: input.tenant_id,
          plan_id: input.plan_id,
          status: input.status,
          start_date: new Date(),
          price: input.price,
          discount: input.discount ?? null,
          currency: input.currency,
          billing_cycle: input.billing_cycle,
          notes: input.notes ?? null,
          created_by: admin.id,
        },
      });

  await prisma.tenant_subscription_history.create({
    data: {
      tenant_subscription_id: subscription.id,
      action: existing ? "UPDATED" : "CREATED",
      new_data: { plan_id: input.plan_id, status: input.status },
      changed_by: admin.id,
    },
  });

  revalidatePath("/app-owner/tenants");
  return { success: true };
}
