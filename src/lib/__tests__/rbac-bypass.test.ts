import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetTenantInfo, mockEvaluatePermission } = vi.hoisted(() => ({
  mockGetTenantInfo: vi.fn(),
  mockEvaluatePermission: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getTenantInfo: mockGetTenantInfo,
}));

vi.mock("@/features/rbac/services/evaluation.service", () => ({
  evaluationService: {
    evaluatePermission: mockEvaluatePermission,
  },
}));

import { hasPermission, isBypassRole } from "@/lib/rbac";

describe("isBypassRole (unified permission bypass identity)", () => {
  it("grants bypass to tenant super-users and the platform operator", () => {
    expect(isBypassRole("owner")).toBe(true);
    expect(isBypassRole("admin")).toBe(true);
    expect(isBypassRole("app_owner")).toBe(true);
  });

  it("does not bypass regular clinic roles", () => {
    expect(isBypassRole("staff")).toBe(false);
    expect(isBypassRole("doctor")).toBe(false);
    expect(isBypassRole("patient")).toBe(false);
  });

  it("does not bypass on missing/unknown roles", () => {
    expect(isBypassRole(null)).toBe(false);
    expect(isBypassRole(undefined)).toBe(false);
    expect(isBypassRole("")).toBe(false);
    // "Super Admin" is an RBAC role NAME, never a profiles.role value — must not
    // accidentally match here (that was the original dead-code bug).
    expect(isBypassRole("Super Admin")).toBe(false);
  });
});

describe("hasPermission for app_owner without a clinic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants permission to an active app_owner even when clinicId is null", async () => {
    mockGetTenantInfo.mockResolvedValueOnce({
      role: "app_owner",
      profileStatus: "active",
      clinicId: null,
      profileId: "ao-1",
    });

    await expect(hasPermission("settings.roles.manage")).resolves.toBe(true);
    expect(mockEvaluatePermission).not.toHaveBeenCalled();
  });

  it("denies permission when the app_owner profile is blocked", async () => {
    mockGetTenantInfo.mockResolvedValueOnce({
      role: "app_owner",
      profileStatus: "blocked",
      clinicId: null,
      profileId: "ao-1",
    });

    await expect(hasPermission("settings.roles.manage")).resolves.toBe(false);
    expect(mockEvaluatePermission).not.toHaveBeenCalled();
  });
});
