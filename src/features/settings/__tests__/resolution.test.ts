// src/features/settings/__tests__/resolution.test.ts
import { describe, it, expect } from "vitest";
import { ResolutionService } from "../services/resolution.service";
import type { SettingDefinition } from "../domain/models";

const service = new ResolutionService();

function makeDefinition(overrides: Partial<SettingDefinition> = {}): SettingDefinition {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    key: "appointments.slot_duration_minutes",
    module: "appointments",
    category: "scheduling",
    value_type: "number",
    default_value: 30,
    validation: { min: 5, max: 240 },
    allowed_scopes: ["platform", "tenant", "user"],
    is_sensitive: false,
    is_public: true,
    description: null,
    display_order: 10,
    ...overrides,
  };
}

describe("ResolutionService — layered precedence", () => {
  it("resolves the definition default when no layer has a value", () => {
    const resolved = service.resolveSetting(makeDefinition(), {});
    expect(resolved.value).toBe(30);
    expect(resolved.source).toBe("default");
  });

  it("platform value beats the default", () => {
    const resolved = service.resolveSetting(makeDefinition(), {
      platform: new Map([["appointments.slot_duration_minutes", 45]]),
    });
    expect(resolved.value).toBe(45);
    expect(resolved.source).toBe("platform");
  });

  it("tenant value beats platform", () => {
    const resolved = service.resolveSetting(makeDefinition(), {
      platform: new Map([["appointments.slot_duration_minutes", 45]]),
      tenant: new Map([["appointments.slot_duration_minutes", 20]]),
    });
    expect(resolved.value).toBe(20);
    expect(resolved.source).toBe("tenant");
  });

  it("user value beats tenant and platform", () => {
    const resolved = service.resolveSetting(makeDefinition(), {
      platform: new Map([["appointments.slot_duration_minutes", 45]]),
      tenant: new Map([["appointments.slot_duration_minutes", 20]]),
      user: new Map([["appointments.slot_duration_minutes", 15]]),
    });
    expect(resolved.value).toBe(15);
    expect(resolved.source).toBe("user");
  });
});

describe("ResolutionService — allowed_scopes enforcement", () => {
  it("ignores a user value when 'user' is not an allowed scope", () => {
    const definition = makeDefinition({ allowed_scopes: ["platform", "tenant"] });
    const resolved = service.resolveSetting(definition, {
      tenant: new Map([["appointments.slot_duration_minutes", 20]]),
      user: new Map([["appointments.slot_duration_minutes", 15]]),
    });
    expect(resolved.value).toBe(20);
    expect(resolved.source).toBe("tenant");
  });

  it("ignores a platform value when 'platform' is not an allowed scope", () => {
    const definition = makeDefinition({ allowed_scopes: ["tenant"] });
    const resolved = service.resolveSetting(definition, {
      platform: new Map([["appointments.slot_duration_minutes", 45]]),
    });
    expect(resolved.value).toBe(30);
    expect(resolved.source).toBe("default");
  });
});

describe("ResolutionService — stale value fallback", () => {
  it("falls through to the next layer when a stored value fails validation", () => {
    const resolved = service.resolveSetting(makeDefinition(), {
      tenant: new Map([["appointments.slot_duration_minutes", "not-a-number"]]),
      platform: new Map([["appointments.slot_duration_minutes", 45]]),
    });
    expect(resolved.value).toBe(45);
    expect(resolved.source).toBe("platform");
  });

  it("falls back to default when every stored layer is invalid", () => {
    const resolved = service.resolveSetting(makeDefinition(), {
      tenant: new Map([["appointments.slot_duration_minutes", 9999]]), // above max
      platform: new Map([["appointments.slot_duration_minutes", "bad"]]),
    });
    expect(resolved.value).toBe(30);
    expect(resolved.source).toBe("default");
  });
});

describe("ResolutionService — sensitive masking and public filtering", () => {
  it("masks sensitive values and reports whether one is set", () => {
    const definition = makeDefinition({
      key: "notifications.smtp_password",
      value_type: "string",
      validation: null,
      is_sensitive: true,
      default_value: "",
    });
    const resolved = service.resolveSetting(definition, {
      tenant: new Map([["notifications.smtp_password", "super-secret"]]),
    });
    expect(resolved.value).toEqual({ masked: true, hasValue: true });
  });

  it("publicOnly returns only is_public definitions", () => {
    const definitions = [
      makeDefinition(),
      makeDefinition({ key: "billing.tax_rate_percent", is_public: false }),
    ];
    const resolved = service.resolveAll(definitions, {}, { publicOnly: true });
    expect(resolved.map((s) => s.key)).toEqual(["appointments.slot_duration_minutes"]);
  });

  it("module filter returns only that module's definitions", () => {
    const definitions = [
      makeDefinition(),
      makeDefinition({ key: "branding.primary_color", module: "branding", value_type: "color", default_value: "#0ea5e9", validation: null }),
    ];
    const resolved = service.resolveAll(definitions, {}, { module: "branding" });
    expect(resolved.map((s) => s.key)).toEqual(["branding.primary_color"]);
  });
});
