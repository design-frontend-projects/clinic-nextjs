import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAppOwner,
  mockCreateUserWithPassword,
  mockRollbackAuthUser,
  mockRevalidatePath,
  mockTx,
  mockPrisma,
} = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    clinics: { create: vi.fn(), update: vi.fn() },
    profiles: { upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    tenant_subscriptions: {
      create: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    branches: { create: vi.fn() },
    clinic_branches: { count: vi.fn(), create: vi.fn() },
    payment_records: { create: vi.fn() },
    tenant_subscription_history: { create: vi.fn() },
    audit_logs: { create: vi.fn() },
    notifications: { createMany: vi.fn() },
  };
  return {
    mockRequireAppOwner: vi.fn(),
    mockCreateUserWithPassword: vi.fn(),
    mockRollbackAuthUser: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockTx: tx,
    mockPrisma: {
      profiles: { findFirst: vi.fn() },
      subscription_plans: { findFirst: vi.fn() },
      clinics: { findFirst: vi.fn(), findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/app-owner-auth", () => ({
  requireAppOwner: mockRequireAppOwner,
}));
vi.mock("@/lib/invitations", () => ({
  createUserAccount: vi.fn(),
  createUserAccountWithPassword: mockCreateUserWithPassword,
  rollbackAuthUser: mockRollbackAuthUser,
  sendSetPasswordLink: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSupabaseSession: vi.fn(),
  getTenantInfo: vi.fn(),
}));
vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({ url: "https://example.supabase.co", anonKey: "k" }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(async () => ({ get: () => null })),
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

import {
  checkTenantRequestStatusAction,
  requestTenantAccountAction,
} from "../auth";
import {
  approveTenantRequest,
  rejectTenantRequest,
} from "../app-owner/tenants";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";

describe("tenant request & app_owner approval actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("requestTenantAccountAction", () => {
    const validRequest = {
      fullName: "Dr. Sara Ali",
      email: "Sara@Clinic.com",
      phone: "+201001234567",
      password: "Password123!",
      confirmPassword: "Password123!",
      clinicName: "Al Noor Clinic",
      registrationNumber: "REG-99",
      clinicEmail: "",
      clinicPhone: "",
      planId: PLAN_ID,
    };

    it("rejects duplicate emails before creating an auth user", async () => {
      mockPrisma.profiles.findFirst.mockResolvedValueOnce({ id: OWNER_ID });
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
      });

      const res = await requestTenantAccountAction(validRequest);
      expect(res).toEqual({
        error:
          "An account or request with this email already exists. Use Track Request Status or Sign In.",
      });
      expect(mockCreateUserWithPassword).not.toHaveBeenCalled();
    });

    it("creates under_review clinic with Ref #, inactive profile, pending_approval sub, and notifies app_owners", async () => {
      mockPrisma.profiles.findFirst.mockResolvedValueOnce(null);
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
        billing_period: "monthly",
        price: 99,
        currency: "USD",
      });
      mockCreateUserWithPassword.mockResolvedValueOnce({
        user: { id: "auth-1" },
      });
      mockTx.$queryRaw.mockResolvedValueOnce([{ nextval: 7n }]);
      mockTx.clinics.create.mockResolvedValueOnce({
        id: TENANT_ID,
        name: "Al Noor Clinic",
      });
      mockTx.profiles.upsert.mockResolvedValueOnce({ id: OWNER_ID });
      mockTx.profiles.findMany.mockResolvedValueOnce([{ id: "app-owner-1" }]);

      const res = await requestTenantAccountAction(validRequest);

      expect(res).toMatchObject({
        success: true,
        clinicName: "Al Noor Clinic",
        email: "sara@clinic.com",
      });
      if ("success" in res) {
        expect(res.requestRef).toMatch(/^REQ-\d{4}-0007$/);
      }
      expect(mockTx.clinics.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "under_review",
            name: "Al Noor Clinic",
          }),
        }),
      );
      expect(mockTx.profiles.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: "inactive",
            role: "owner",
            is_owner: true,
          }),
        }),
      );
      expect(mockTx.tenant_subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "pending_approval",
            payment_status: "pending",
          }),
        }),
      );
      expect(mockTx.notifications.createMany).toHaveBeenCalledTimes(1);
    });

    it("rolls back auth user if DB transaction fails", async () => {
      mockPrisma.profiles.findFirst.mockResolvedValueOnce(null);
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
        billing_period: "monthly",
        price: 99,
        currency: "USD",
      });
      mockCreateUserWithPassword.mockResolvedValueOnce({
        user: { id: "auth-orphan" },
      });
      mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB error"));

      const res = await requestTenantAccountAction(validRequest);
      expect(res).toEqual({
        error: "Failed to submit account request. Please try again.",
      });
      expect(mockRollbackAuthUser).toHaveBeenCalledWith("auth-orphan");
    });
  });

  describe("checkTenantRequestStatusAction", () => {
    it("returns details only when both request_ref and owner email match", async () => {
      mockPrisma.clinics.findFirst.mockResolvedValueOnce({
        request_ref: "REQ-2026-0007",
        name: "Al Noor Clinic",
        status: "under_review",
        created_at: new Date("2026-06-01T00:00:00Z"),
        reviewed_at: null,
        rejection_reason: null,
        staff_profiles: [{ email: "sara@clinic.com" }],
        tenant_subscription: {
          payment_status: "pending",
          start_date: new Date("2026-06-01T00:00:00Z"),
          end_date: null,
          plan: { name: "Pro" },
        },
      });

      const ok = await checkTenantRequestStatusAction({
        requestRef: "req-2026-0007",
        email: "SARA@clinic.com",
      });
      expect(ok).toMatchObject({
        success: true,
        request: {
          requestRef: "REQ-2026-0007",
          clinicName: "Al Noor Clinic",
          status: "under_review",
          planName: "Pro",
        },
      });

      mockPrisma.clinics.findFirst.mockResolvedValueOnce({
        request_ref: "REQ-2026-0007",
        staff_profiles: [{ email: "sara@clinic.com" }],
      });
      const mismatch = await checkTenantRequestStatusAction({
        requestRef: "REQ-2026-0007",
        email: "other@clinic.com",
      });
      expect(mismatch).toEqual({
        error:
          "No matching request found for that reference number and email.",
      });
    });
  });

  describe("approveTenantRequest & rejectTenantRequest", () => {
    it("blocks non-app_owner callers from approving", async () => {
      mockRequireAppOwner.mockResolvedValueOnce({
        id: "owner-1",
        role: "owner",
        email: "owner@clinic.com",
      });

      const res = await approveTenantRequest({
        tenantId: TENANT_ID,
        planId: PLAN_ID,
        clinicStatus: "active",
        billingCycle: "monthly",
        price: 99,
        currency: "USD",
        startDate: "2026-06-01",
        endDate: "2026-07-01",
        gracePeriodDays: 7,
        paymentStatus: "paid",
      });

      expect(res).toEqual({
        error: "Only the platform app-owner can approve tenant requests.",
      });
    });

    it("activates clinic, owner profile, default Main Branch, subscription, and payment record on approval", async () => {
      mockRequireAppOwner.mockResolvedValueOnce({
        id: "app-owner-1",
        role: "app_owner",
        email: "platform@clinic.com",
      });
      mockPrisma.clinics.findUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        status: "under_review",
        request_ref: "REQ-2026-0007",
        auth_user_id: "auth-1",
        onboarding_completed_at: null,
        staff_profiles: [{ id: OWNER_ID, email: "sara@clinic.com" }],
      });
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
        price: 99,
      });
      mockTx.clinic_branches.count.mockResolvedValueOnce(0);
      mockTx.branches.create.mockResolvedValueOnce({ id: "branch-1" });
      mockTx.tenant_subscriptions.upsert.mockResolvedValueOnce({ id: "sub-1" });

      const res = await approveTenantRequest({
        tenantId: TENANT_ID,
        planId: PLAN_ID,
        clinicStatus: "active",
        billingCycle: "monthly",
        price: 99,
        discount: 10,
        currency: "USD",
        startDate: "2026-06-01",
        endDate: "2026-07-01",
        gracePeriodDays: 7,
        paymentStatus: "paid",
        paymentReference: "TX-123",
      });

      expect(res).toEqual({ success: true });
      expect(mockTx.clinics.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "active" }),
        }),
      );
      expect(mockTx.profiles.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "active",
            is_profile_completed: true,
          }),
        }),
      );
      expect(mockTx.branches.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "Main Branch" }),
        }),
      );
      expect(mockTx.clinic_branches.create).toHaveBeenCalledTimes(1);
      expect(mockTx.payment_records.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 89,
            status: "paid",
            reference: "TX-123",
          }),
        }),
      );
    });

    it("rejects an under_review request with reason", async () => {
      mockRequireAppOwner.mockResolvedValueOnce({
        id: "app-owner-1",
        role: "app_owner",
        email: "platform@clinic.com",
      });
      mockPrisma.clinics.findUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        status: "under_review",
        request_ref: "REQ-2026-0007",
      });

      const res = await rejectTenantRequest({
        tenantId: TENANT_ID,
        reason: "Missing license number",
      });

      expect(res).toEqual({ success: true });
      expect(mockTx.clinics.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "rejected",
            rejection_reason: "Missing license number",
          }),
        }),
      );
      expect(mockTx.tenant_subscriptions.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "cancelled" }),
        }),
      );
    });
  });
});
