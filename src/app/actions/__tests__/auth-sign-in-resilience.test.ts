import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetTenantInfo,
  mockGetSupabaseSession,
  mockCookieSet,
  mockCookieDelete,
  mockHeadersGet,
} = vi.hoisted(() => ({
  mockGetTenantInfo: vi.fn(),
  mockGetSupabaseSession: vi.fn(),
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
  mockHeadersGet: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getTenantInfo: mockGetTenantInfo,
  getSupabaseSession: mockGetSupabaseSession,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookieSet,
    delete: mockCookieDelete,
    getAll: () => [],
  })),
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  clearSignOutCookies,
  completeSignIn,
  syncOnboardingCookie,
  getPostSignInRedirect,
} from "../auth";

describe("auth sign-in server actions resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("syncOnboardingCookie does not throw when getTenantInfo rejects (e.g. DB unreachable)", async () => {
    mockGetTenantInfo.mockRejectedValueOnce(
      new Error("getaddrinfo EAI_AGAIN base"),
    );

    await expect(syncOnboardingCookie()).resolves.toBeUndefined();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("syncOnboardingCookie sets onboarding_complete with secure=false on HTTP requests", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "x-forwarded-proto" ? "http" : null,
    );
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: "clinic-1",
      is_owner: false,
      is_profile_completed: true,
    });

    await syncOnboardingCookie();
    expect(mockCookieSet).toHaveBeenCalledWith(
      "onboarding_complete",
      "1",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        path: "/",
        sameSite: "lax",
      }),
    );
  });

  it("syncOnboardingCookie sets onboarding_complete with secure=true on HTTPS requests", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "x-forwarded-proto" ? "https" : null,
    );
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: "clinic-1",
      is_owner: false,
      is_profile_completed: true,
    });

    await syncOnboardingCookie();
    expect(mockCookieSet).toHaveBeenCalledWith(
      "onboarding_complete",
      "1",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        path: "/",
        sameSite: "lax",
      }),
    );
  });

  it("getPostSignInRedirect falls back to JWT role when getTenantInfo rejects", async () => {
    mockGetTenantInfo.mockRejectedValueOnce(
      new Error("getaddrinfo EAI_AGAIN base"),
    );
    mockGetSupabaseSession.mockResolvedValueOnce({
      user: { app_metadata: { roles: ["doctor"] } },
    });

    const target = await getPostSignInRedirect();
    expect(target).toBe("/doctor");
  });

  it("getPostSignInRedirect falls back to /admin when both DB and session lookup fail", async () => {
    mockGetTenantInfo.mockRejectedValueOnce(new Error("DB error"));
    mockGetSupabaseSession.mockRejectedValueOnce(new Error("Auth error"));

    const target = await getPostSignInRedirect();
    expect(target).toBe("/admin");
  });

  it("completeSignIn sets onboarding_complete and resolves role route in a single getTenantInfo call", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "x-forwarded-proto" ? "https" : null,
    );
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: "clinic-1",
      role: "doctor",
      is_owner: false,
      is_profile_completed: true,
    });

    const result = await completeSignIn();
    expect(result).toEqual({ redirectPath: "/doctor" });
    expect(mockGetTenantInfo).toHaveBeenCalledTimes(1);
    expect(mockCookieSet).toHaveBeenCalledWith(
      "onboarding_complete",
      "1",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        path: "/",
        sameSite: "lax",
      }),
    );
  });

  it("completeSignIn skips onboarding_complete for an owner still mid-onboarding", async () => {
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: "clinic-1",
      role: "owner",
      is_owner: true,
      is_profile_completed: false,
    });

    const result = await completeSignIn();
    expect(result).toEqual({ redirectPath: "/admin" });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("completeSignIn falls back to JWT role when getTenantInfo throws", async () => {
    mockGetTenantInfo.mockRejectedValueOnce(new Error("DB timeout"));
    mockGetSupabaseSession.mockResolvedValueOnce({
      user: { app_metadata: { roles: ["staff"] } },
    });

    const result = await completeSignIn();
    expect(result).toEqual({ redirectPath: "/staff" });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("clearSignOutCookies deletes onboarding and active tenant/branch cookies", async () => {
    await clearSignOutCookies();
    expect(mockCookieDelete).toHaveBeenCalledWith("onboarding_complete");
    expect(mockCookieDelete).toHaveBeenCalledWith("active_clinic_id");
    expect(mockCookieDelete).toHaveBeenCalledWith("active_branch_id");
  });
});
