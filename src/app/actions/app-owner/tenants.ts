"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import { ClinicStatus, UserStatus } from "@prisma/client";
import { sendSetPasswordLink } from "@/lib/invitations";
import {
  tenantSubscriptionSchema,
  type TenantSubscriptionData,
} from "@/types/subscription.types";

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
