// src/features/settings/services/feature.service.ts
// Feature flag evaluation. Chain (first hit wins):
//   1. kill_switch          -> disabled for everyone
//   2. environment gate     -> flag not enabled for the current NODE_ENV
//   3. tenant override      -> app-owner-granted exception (unexpired)
//   4. plan entitlement     -> subscription_features of the tenant's plan
//   5. flag default_enabled
import { SettingsRepository } from "../repositories/settings.repository";
import { SettingsCacheService, settingsCacheService } from "./cache.service";
import type { FeatureDecision } from "../domain/models";

interface FlagRow {
  key: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  default_enabled: boolean;
  kill_switch: boolean;
  environments: string[];
  is_beta: boolean;
}

interface OverrideRow {
  feature_key: string;
  is_enabled: boolean;
  expires_at: Date | null;
}

export function evaluateFlag(
  flag: FlagRow,
  override: OverrideRow | undefined,
  planFeatures: { feature_name: string; is_enabled: boolean }[] | null,
  environment: string,
  now: Date = new Date()
): FeatureDecision {
  const base = {
    key: flag.key,
    name: flag.name,
    name_ar: flag.name_ar,
    description: flag.description,
    is_beta: flag.is_beta,
  };

  if (flag.kill_switch) {
    return { ...base, enabled: false, source: "kill_switch" };
  }
  if (flag.environments.length > 0 && !flag.environments.includes(environment)) {
    return { ...base, enabled: false, source: "environment" };
  }
  if (override && (override.expires_at === null || override.expires_at > now)) {
    return { ...base, enabled: override.is_enabled, source: "tenant_override" };
  }
  const entitlement = planFeatures?.find((f) => f.feature_name === flag.key);
  if (entitlement) {
    return { ...base, enabled: entitlement.is_enabled, source: "plan" };
  }
  return { ...base, enabled: flag.default_enabled, source: "default" };
}

export class FeatureService {
  constructor(
    private repo: SettingsRepository = new SettingsRepository(),
    private cache: SettingsCacheService = settingsCacheService
  ) {}

  private environment(): string {
    return process.env.NODE_ENV === "production" ? "production" : "development";
  }

  /** Every flag evaluated for a tenant (cached). */
  async getTenantFeatures(tenantId: string): Promise<FeatureDecision[]> {
    const cached = (await this.cache.getFeatures(tenantId)) as FeatureDecision[] | null;
    if (cached) return cached;

    const [flags, overrides, planFeatures] = await Promise.all([
      this.repo.findFeatureFlags(),
      this.repo.findTenantFeatureOverrides(tenantId),
      this.repo.findPlanFeaturesForTenant(tenantId),
    ]);

    const decisions = flags.map((flag) =>
      evaluateFlag(
        flag,
        overrides.find((o) => o.feature_key === flag.key),
        planFeatures,
        this.environment()
      )
    );
    await this.cache.setFeatures(tenantId, decisions);
    return decisions;
  }

  async isEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    const decisions = await this.getTenantFeatures(tenantId);
    const decision = decisions.find((d) => d.key === featureKey);
    // Deny-by-default: unknown flags are disabled.
    return decision?.enabled ?? false;
  }

  async invalidate(tenantId: string): Promise<void> {
    await this.cache.invalidateFeatures(tenantId);
  }
}

export const featureService = new FeatureService();
