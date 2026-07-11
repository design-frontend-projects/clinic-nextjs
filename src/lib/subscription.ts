import { requireTenantInfo } from "./auth";
import { isBypassRole } from "./rbac";

type SubscriptionPlan = "free" | "pro" | "enterprise";

const PLAN_HIERARCHY: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Checks if the current tenant's subscription meets the required plan level.
 * Throws an error if they don't.
 *
 * @deprecated Prefer `requireFeature()` from `src/lib/features.ts` — it
 * evaluates real plan entitlements (subscription_features) plus feature flags
 * and per-tenant overrides, instead of this legacy plan-name string check.
 */
export async function requireSubscription(requiredPlan: SubscriptionPlan) {
  const tenant = await requireTenantInfo();
  
  // Admins/owners bypass subscription checks
  if (isBypassRole(tenant.role)) {
    return true;
  }

  const currentPlan = (tenant.subscriptionPlan || "free") as SubscriptionPlan;
  
  const currentLevel = PLAN_HIERARCHY[currentPlan] ?? 0;
  const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

  if (currentLevel < requiredLevel) {
    throw new Error(`Upgrade required: This feature requires the ${requiredPlan} plan or higher.`);
  }

  return true;
}

/**
 * Checks if the current tenant's subscription meets the required plan level
 * without throwing an error, returning a boolean.
 *
 * @deprecated Prefer `hasFeature()` from `src/lib/features.ts` (see
 * requireSubscription above).
 */
export async function hasSubscription(requiredPlan: SubscriptionPlan) {
  try {
    const tenant = await requireTenantInfo();
    
    if (isBypassRole(tenant.role)) {
      return true;
    }

    const currentPlan = (tenant.subscriptionPlan || "free") as SubscriptionPlan;
    
    const currentLevel = PLAN_HIERARCHY[currentPlan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

    return currentLevel >= requiredLevel;
  } catch (error) {
    return false;
  }
}
