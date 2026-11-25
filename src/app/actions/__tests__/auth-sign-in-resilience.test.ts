import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetTenantInfo,
  mockGetSupabaseSession,
  mockCookieSet,
  mockCookieDelete,
  mockHeadersGet,
  mockSupabaseSignOut,
} = vi.hoisted(() => ({
  mockGetTenantInfo: vi.fn(),
  mockGetSupabaseSession: vi.fn(),
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
  mockHeadersGet: vi.fn(),
  mockSupabaseSignOut: vi.fn(async () => ({ error: null })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { signOut: mockSupabaseSignOut },
  })),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({ url: "https://example.supabase.co", anonKey: "k" }),
}));

vi.mock("@/lib/invitations", () => ({
  createUserAccountWithPassword: vi.fn(),
  rollbackAuthUser: vi.fn(),
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
    expect(result).toEqual({ blocked: false, redirectPath: "/doctor" });
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
      access: { allowed: true, warning: null },
    });

    const result = await completeSignIn();
    expect(result).toEqual({ blocked: false, redirectPath: "/admin" });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("completeSignIn sets onboarding_complete and redirects app_owner to /app-owner even with no clinic", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "x-forwarded-proto" ? "https" : null,
    );
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: null,
      role: "app_owner",
      is_owner: true,
      is_profile_completed: false,
      access: { allowed: true, warning: null },
    });

    const result = await completeSignIn();
    expect(result).toEqual({ blocked: false, redirectPath: "/app-owner" });
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

  it("syncOnboardingCookie sets onboarding_complete for app_owner with null clinicId", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "x-forwarded-proto" ? "http" : null,
    );
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: null,
      role: "app_owner",
      is_owner: false,
      is_profile_completed: false,
      access: { allowed: true, warning: null },
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

  it("completeSignIn blocks a blocked app_owner and signs out session", async () => {
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: null,
      role: "app_owner",
      is_owner: false,
      is_profile_completed: false,
      access: { allowed: false, code: "account_blocked" },
    });

    const result = await completeSignIn();
    expect(result).toEqual({
      blocked: true,
      access: { allowed: false, code: "account_blocked" },
    });
    expect(mockSupabaseSignOut).toHaveBeenCalledTimes(1);
    expect(mockCookieDelete).toHaveBeenCalledWith("onboarding_complete");
  });

  it("completeSignIn blocks sign-in, signs out session, and clears cookies when tenant access is denied", async () => {
    mockGetTenantInfo.mockResolvedValueOnce({
      clinicId: "clinic-1",
      role: "owner",
      is_owner: true,
      is_profile_completed: false,
      access: {
        allowed: false,
        code: "under_review",
        requestRef: "REQ-2026-0009",
      },
    });

    const result = await completeSignIn();
    expect(result).toEqual({
      blocked: true,
      access: {
        allowed: false,
        code: "under_review",
        requestRef: "REQ-2026-0009",
      },
    });
    expect(mockSupabaseSignOut).toHaveBeenCalledTimes(1);
    expect(mockCookieDelete).toHaveBeenCalledWith("onboarding_complete");
    expect(mockCookieDelete).toHaveBeenCalledWith("active_clinic_id");
    expect(mockCookieDelete).toHaveBeenCalledWith("active_branch_id");
  });

  it("completeSignIn falls back to JWT role when getTenantInfo throws", async () => {
    mockGetTenantInfo.mockRejectedValueOnce(new Error("DB timeout"));
    mockGetSupabaseSession.mockResolvedValueOnce({
      user: { app_metadata: { roles: ["staff"] } },
    });

    const result = await completeSignIn();
    expect(result).toEqual({ blocked: false, redirectPath: "/staff" });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("clearSignOutCookies deletes onboarding and active tenant/branch cookies", async () => {
    await clearSignOutCookies();
    expect(mockCookieDelete).toHaveBeenCalledWith("onboarding_complete");
    expect(mockCookieDelete).toHaveBeenCalledWith("active_clinic_id");
    expect(mockCookieDelete).toHaveBeenCalledWith("active_branch_id");
  });
});
