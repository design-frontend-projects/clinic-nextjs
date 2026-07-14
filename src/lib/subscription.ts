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
 * Throws an error if they don't. Gates features by the tenant's plan-name tier
 * (`free < pro < enterprise`); admins/owners bypass.
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
