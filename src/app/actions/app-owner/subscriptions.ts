"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import {
  fetchTenantAccountSnapshot,
  resolveTenantOwnerAuthId,
} from "@/lib/tenant-subscription-snapshot";
import {
  tenantSubscriptionUpsertSchema,
  type TenantSubscriptionUpsertData,
} from "@/types/subscription.types";

/**
 * Fetch all tenant subscriptions
 */
export async function getTenantSubscriptions() {
  await requireAppOwner();

  return await prisma.tenant_subscriptions.findMany({
    include: {
      owner_profile: true,
      plan: true,
    },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Assign or update a subscription for a tenant
 */
export async function upsertTenantSubscription(data: TenantSubscriptionUpsertData) {
  const admin = await requireAppOwner();

  const parsed = tenantSubscriptionUpsertSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid subscription data" };
  }
  const {
    tenant_id,
    plan_id,
    status,
    start_date,
    end_date,
    price,
    discount,
    billing_cycle,
    payment_status,
    payment_reference,
    notes,
  } = parsed.data;

  // Resolve tenant owner auth_user_id (accepts auth_user_id directly or clinic.id)
  const resolvedOwner = await resolveTenantOwnerAuthId(prisma, tenant_id);
  if (!resolvedOwner) {
    throw new Error("Tenant must have a primary owner before assigning a subscription.");
  }
  const ownerAuthUserId = resolvedOwner.ownerAuthUserId;

  const existingSub = await prisma.tenant_subscriptions.findUnique({
    where: { tenant_id: ownerAuthUserId },
  });

  let subscription;

  if (existingSub) {
    // Update
    subscription = await prisma.tenant_subscriptions.update({
      where: { tenant_id: ownerAuthUserId },
      data: {
        plan_id,
        status,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        price,
        discount,
        billing_cycle,
        payment_status,
        payment_reference,
        notes,
        updated_by: admin.id,
      },
    });

    // Log history
    await prisma.tenant_subscription_history.create({
      data: {
        tenant_subscription_id: subscription.id,
        action: "UPDATED",
        previous_data: existingSub as any,
        new_data: subscription as any,
        changed_by: admin.id,
      },
    });
  } else {
    // Create
    subscription = await prisma.tenant_subscriptions.create({
      data: {
        tenant_id: ownerAuthUserId,
        plan_id,
        status,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        price,
        discount,
        billing_cycle,
        payment_status,
        payment_reference,
        notes,
        created_by: admin.id,
      },
    });

    // Log history
    await prisma.tenant_subscription_history.create({
      data: {
        tenant_subscription_id: subscription.id,
        action: "CREATED",
        new_data: subscription as any,
        changed_by: admin.id,
      },
    });
  }

  // Record payment if needed
  if (payment_status === "paid") {
    await prisma.payment_records.create({
      data: {
        tenant_subscription_id: subscription.id,
        amount: Number(price) - Number(discount || 0),
        status: "paid",
        reference: payment_reference,
      },
    });
  }

  const snapshot = await fetchTenantAccountSnapshot(prisma, ownerAuthUserId);

  revalidatePath("/app-owner/tenants");
  revalidatePath(`/app-owner/tenants/${tenant_id}`);
  return {
    success: true as const,
    subscription: snapshot.subscription,
    profile: snapshot.profile,
  };
}
