// src/lib/features.ts
// Feature flag facade. Evaluation chain: kill_switch > environment >
// tenant override > plan entitlement (subscription_features) > flag default.
// Unlike permission checks there is NO role bypass — entitlements are about
// what the tenant's plan includes, not who is asking.
// Prefer these over src/lib/subscription.ts (legacy string-tier gate).
import { cache } from "react";
import { getTenantInfo } from "@/lib/auth";
import { featureService } from "@/features/settings/services/feature.service";
import type { FeatureDecision } from "@/features/settings/domain/models";

const getDecisionsForCurrentTenant = cache(async (): Promise<FeatureDecision[]> => {
  const tenant = await getTenantInfo();
  if (!tenant?.clinicId) return [];
  return featureService.getTenantFeatures(tenant.clinicId);
});

/** True when the feature is enabled for the current tenant. Unknown keys are false. */
export async function hasFeature(featureKey: string): Promise<boolean> {
  const decisions = await getDecisionsForCurrentTenant();
  return decisions.find((d) => d.key === featureKey)?.enabled ?? false;
}

/** Throws when the feature is not enabled for the current tenant. */
export async function requireFeature(featureKey: string): Promise<true> {
  if (!(await hasFeature(featureKey))) {
    throw new Error(`Feature not available: ${featureKey}`);
  }
  return true;
}

/** All evaluated flags for the current tenant (for settings/feature UIs). */
export async function getFeatureDecisions(): Promise<FeatureDecision[]> {
  return getDecisionsForCurrentTenant();
}
