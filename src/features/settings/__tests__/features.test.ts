// src/features/settings/__tests__/features.test.ts
import { describe, it, expect, vi } from "vitest";
import { FeatureService, evaluateFlag } from "../services/feature.service";
import type { SettingsRepository } from "../repositories/settings.repository";
import type { SettingsCacheService } from "../services/cache.service";

const NOW = new Date("2026-07-10T12:00:00Z");

function flag(overrides: Record<string, unknown> = {}) {
  return {
    key: "sms_reminders",
    name: "SMS Reminders",
    name_ar: null,
    description: null,
    default_enabled: false,
    kill_switch: false,
    environments: ["production", "development"],
    is_beta: false,
    ...overrides,
  };
}

describe("evaluateFlag — chain order", () => {
  it("kill switch dominates everything, including overrides", () => {
    const decision = evaluateFlag(
      flag({ kill_switch: true, default_enabled: true }),
      { feature_key: "sms_reminders", is_enabled: true, expires_at: null },
      [{ feature_name: "sms_reminders", is_enabled: true }],
      "development",
      NOW
    );
    expect(decision.enabled).toBe(false);
    expect(decision.source).toBe("kill_switch");
  });

  it("environment gate disables flags outside their environments", () => {
    const decision = evaluateFlag(flag({ environments: ["production"] }), undefined, null, "development", NOW);
    expect(decision.enabled).toBe(false);
    expect(decision.source).toBe("environment");
  });

  it("an unexpired tenant override beats the plan entitlement", () => {
    const decision = evaluateFlag(
      flag(),
      { feature_key: "sms_reminders", is_enabled: true, expires_at: new Date("2027-01-01") },
      [{ feature_name: "sms_reminders", is_enabled: false }],
      "development",
      NOW
    );
    expect(decision.enabled).toBe(true);
    expect(decision.source).toBe("tenant_override");
  });

  it("an expired override is ignored and the plan decides", () => {
    const decision = evaluateFlag(
      flag(),
      { feature_key: "sms_reminders", is_enabled: true, expires_at: new Date("2026-01-01") },
      [{ feature_name: "sms_reminders", is_enabled: true }],
      "development",
      NOW
    );
    expect(decision.enabled).toBe(true);
    expect(decision.source).toBe("plan");
  });

  it("plan entitlement decides when there is no override", () => {
    const enabled = evaluateFlag(
      flag(),
      undefined,
      [{ feature_name: "sms_reminders", is_enabled: true }],
      "development",
      NOW
    );
    expect(enabled.enabled).toBe(true);
    expect(enabled.source).toBe("plan");

    const disabled = evaluateFlag(
      flag({ default_enabled: true }),
      undefined,
      [{ feature_name: "sms_reminders", is_enabled: false }],
      "development",
      NOW
    );
    expect(disabled.enabled).toBe(false);
    expect(disabled.source).toBe("plan");
  });

  it("falls back to default_enabled when no plan resolves (legacy tenants)", () => {
    const decision = evaluateFlag(flag({ default_enabled: true }), undefined, null, "development", NOW);
    expect(decision.enabled).toBe(true);
    expect(decision.source).toBe("default");
  });

  it("falls back to default when the plan has no row for this flag", () => {
    const decision = evaluateFlag(
      flag({ default_enabled: false }),
      undefined,
      [{ feature_name: "other_feature", is_enabled: true }],
      "development",
      NOW
    );
    expect(decision.enabled).toBe(false);
    expect(decision.source).toBe("default");
  });
});

describe("FeatureService", () => {
  function makeService(overrides: { flags?: unknown[]; overridesRows?: unknown[]; plan?: unknown[] | null } = {}) {
    const repo = {
      findFeatureFlags: vi.fn().mockResolvedValue(overrides.flags ?? [flag()]),
      findTenantFeatureOverrides: vi.fn().mockResolvedValue(overrides.overridesRows ?? []),
      findPlanFeaturesForTenant: vi.fn().mockResolvedValue(overrides.plan ?? null),
    } as unknown as SettingsRepository;
    const cache = {
      getFeatures: vi.fn().mockResolvedValue(null),
      setFeatures: vi.fn(),
      invalidateFeatures: vi.fn(),
    } as unknown as SettingsCacheService;
    return { service: new FeatureService(repo, cache), repo, cache };
  }

  it("isEnabled returns false for unknown flags (deny by default)", async () => {
    const { service } = makeService();
    await expect(service.isEnabled("tenant-1", "does_not_exist")).resolves.toBe(false);
  });

  it("evaluates and caches per-tenant decisions", async () => {
    const { service, cache } = makeService({
      plan: [{ feature_name: "sms_reminders", is_enabled: true }],
    });
    await expect(service.isEnabled("tenant-1", "sms_reminders")).resolves.toBe(true);
    expect(cache.setFeatures).toHaveBeenCalledOnce();
  });

  it("serves cached decisions without re-querying the repository", async () => {
    const { service, repo, cache } = makeService();
    (cache.getFeatures as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: "sms_reminders", enabled: true, source: "plan" },
    ]);
    await expect(service.isEnabled("tenant-1", "sms_reminders")).resolves.toBe(true);
    expect(repo.findFeatureFlags).not.toHaveBeenCalled();
  });
});
