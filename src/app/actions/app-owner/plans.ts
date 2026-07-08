"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import {
  subscriptionPlanSchema,
  type SubscriptionPlanFormData,
} from "@/types/subscription.types";

/**
 * Fetch all subscription plans
 */
export async function getSubscriptionPlans() {
  await requireAppOwner();

  return await prisma.subscription_plans.findMany({
    include: {
      features: true,
      _count: {
        select: { tenant_subscriptions: true },
      },
    },
    orderBy: { display_order: "asc" },
  });
}

/**
 * Get a single subscription plan by ID
 */
export async function getSubscriptionPlan(id: string) {
  await requireAppOwner();

  return await prisma.subscription_plans.findUnique({
    where: { id },
    include: { features: true },
  });
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
    return { success: true, plan: updated };
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
    return { success: true, plan: created };
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
  return { success: true };
}
