"use server";

import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import {
  subscriptionPlanSchema,
  type SubscriptionPlanFormData,
} from "@/types/subscription.types";

const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "pending_approval",
  "suspended",
] as const;

/**
 * Fetch all non-deleted subscription plans
 */
export async function getSubscriptionPlans() {
  await requireAppOwner();

  const plans = await prisma.subscription_plans.findMany({
    where: { deleted_at: null },
    include: {
      features: true,
      _count: {
        select: {
          tenant_subscriptions: {
            where: { status: { not: "cancelled" } },
          },
        },
      },
    },
    orderBy: { display_order: "asc" },
  });

  return plans.map((plan) => ({
    ...plan,
    price: Number(plan.price),
  }));
}

/**
 * Get a single non-deleted subscription plan by ID
 */
export async function getSubscriptionPlan(id: string) {
  await requireAppOwner();

  const plan = await prisma.subscription_plans.findFirst({
    where: { id, deleted_at: null },
    include: { features: true },
  });

  if (!plan) return null;

  return {
    ...plan,
    price: Number(plan.price),
  };
}

/**
 * Create or update a subscription plan
 */
export async function upsertSubscriptionPlan(data: SubscriptionPlanFormData) {
  const admin = await requireAppOwner();

  const parsed = subscriptionPlanSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid plan data" };
  }

  const { id, features, ...planData } = parsed.data;

  if (id) {
    // Update existing plan
    const updated = await prisma.subscription_plans.update({
      where: { id },
      data: {
        ...planData,
        updated_by: admin.id,
      },
    });

    // Update features (delete old ones and recreate for simplicity)
    await prisma.subscription_features.deleteMany({
      where: { plan_id: id },
    });

    if (features.length > 0) {
      await prisma.subscription_features.createMany({
        data: features.map((f) => ({
          plan_id: id,
          feature_name: f.feature_name,
          is_enabled: f.is_enabled,
        })),
      });
    }

    revalidatePath("/app-owner/plans");
    revalidatePath("/");
    return {
      success: true,
      plan: {
        ...updated,
        price: Number(updated.price),
      },
    };
  } else {
    // Create new plan
    const created = await prisma.subscription_plans.create({
      data: {
        ...planData,
        created_by: admin.id,
        features: {
          create: features.map((f) => ({
            feature_name: f.feature_name,
            is_enabled: f.is_enabled,
          })),
        },
      },
    });

    revalidatePath("/app-owner/plans");
    revalidatePath("/");
    return {
      success: true,
      plan: {
        ...created,
        price: Number(created.price),
      },
    };
  }
}

/**
 * Archive a subscription plan
 */
export async function archiveSubscriptionPlan(id: string) {
  const admin = await requireAppOwner();

  await prisma.subscription_plans.update({
    where: { id },
    data: {
      status: "archived",
      updated_by: admin.id,
    },
  });

  revalidatePath("/app-owner/plans");
  revalidatePath("/");
  return { success: true };
}

/**
 * Soft-delete (remove) a subscription plan when no active/pending/suspended
 * tenant subscriptions reference it.
 */
export async function removeSubscriptionPlan(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAppOwner();

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) {
    return { error: "Invalid subscription plan ID." };
  }

  const existing = await prisma.subscription_plans.findFirst({
    where: { id: parsedId.data, deleted_at: null },
    select: { id: true },
  });

  if (!existing) {
    return { error: "Subscription plan not found." };
  }

  const activeSubscribers = await prisma.tenant_subscriptions.count({
    where: {
      plan_id: parsedId.data,
      status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
    },
  });

  if (activeSubscribers > 0) {
    return {
      error:
        "Cannot remove a subscription plan while tenants are subscribed to it. Reassign those tenants to another plan first.",
    };
  }

  await prisma.subscription_plans.update({
    where: { id: parsedId.data },
    data: {
      status: "archived",
      deleted_at: new Date(),
      updated_by: admin.id,
    },
  });

  revalidatePath("/app-owner/plans");
  revalidatePath("/");
  return { success: true };
}
