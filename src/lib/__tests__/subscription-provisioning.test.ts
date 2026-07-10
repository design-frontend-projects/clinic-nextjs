import { describe, expect, it } from "vitest";
import {
  planToLegacyTier,
  subscriptionWindow,
} from "@/lib/subscription-provisioning";
import { createTenantSchema } from "@/types/tenant-creation.types";

describe("subscriptionWindow", () => {
  // Local-time start; assertions use local date parts because setMonth()
  // operates in local time (UTC ISO comparisons break across DST boundaries).
  const start = new Date(2026, 0, 15);

  const localParts = (d: Date | null) =>
    d && ([d.getFullYear(), d.getMonth(), d.getDate()] as const);

  it.each([
    ["monthly", [2026, 1, 15]],
    ["quarterly", [2026, 3, 15]],
    ["semi_annual", [2026, 6, 15]],
    ["annual", [2027, 0, 15]],
  ] as const)("%s ends on %j", (period, expected) => {
    const { startDate, endDate } = subscriptionWindow(period, start);
    expect(startDate).toBe(start);
    expect(localParts(endDate)).toEqual(expected);
  });

  it("lifetime has no end date", () => {
    expect(subscriptionWindow("lifetime", start).endDate).toBeNull();
  });

  it("unknown periods fall back to monthly", () => {
    const { endDate } = subscriptionWindow("bogus", start);
    expect(localParts(endDate)).toEqual([2026, 1, 15]);
  });
});

describe("planToLegacyTier", () => {
  it("maps zero-price plans to free", () => {
    expect(planToLegacyTier({ name: "Starter", price: 0 })).toBe("free");
    expect(planToLegacyTier({ name: "Starter", price: "0" })).toBe("free");
  });

  it("maps enterprise-named paid plans to enterprise", () => {
    expect(planToLegacyTier({ name: "Enterprise Plus", price: 199 })).toBe(
      "enterprise",
    );
  });

  it("maps other paid plans to pro", () => {
    expect(planToLegacyTier({ name: "Pro", price: 99 })).toBe("pro");
    expect(planToLegacyTier({ name: "Custom Gold", price: "49.99" })).toBe(
      "pro",
    );
  });
});

describe("createTenantSchema", () => {
  const valid = {
    owner: { full_name: "Jane Doe", email: "jane@clinic.com" },
    clinic: { name: "Sunrise Clinic" },
    plan_id: "9b2e6c1a-4f3d-4a2b-8c1d-2e3f4a5b6c7d",
    branch: {},
  };

  it("accepts a minimal payload and applies defaults", () => {
    const parsed = createTenantSchema.parse(valid);
    expect(parsed.branch.name).toBe("Main Branch");
    expect(parsed.specialtyIds).toEqual([]);
  });

  it("allows empty strings for optional contact fields", () => {
    const parsed = createTenantSchema.parse({
      ...valid,
      owner: { ...valid.owner, phone: "" },
      clinic: { ...valid.clinic, email: "", registration_number: "" },
    });
    expect(parsed.clinic.email).toBe("");
  });

  it("rejects an invalid owner email", () => {
    const result = createTenantSchema.safeParse({
      ...valid,
      owner: { ...valid.owner, email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid plan id", () => {
    const result = createTenantSchema.safeParse({ ...valid, plan_id: "pro" });
    expect(result.success).toBe(false);
  });

  it("rejects a too-short clinic name", () => {
    const result = createTenantSchema.safeParse({
      ...valid,
      clinic: { name: "A" },
    });
    expect(result.success).toBe(false);
  });
});
