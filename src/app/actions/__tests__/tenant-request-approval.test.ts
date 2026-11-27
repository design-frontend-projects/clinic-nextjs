import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAppOwner,
  mockCreateUserAccount,
  mockCreateUserWithPassword,
  mockRollbackAuthUser,
  mockSendSetPasswordLink,
  mockRevalidatePath,
  mockTx,
  mockPrisma,
} = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    clinics: { create: vi.fn(), update: vi.fn() },
    profiles: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    tenant_subscriptions: {
      findUnique: vi.fn(),
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
    doctor_specialties: { createMany: vi.fn() },
  };
  return {
    mockRequireAppOwner: vi.fn(),
    mockCreateUserAccount: vi.fn(),
    mockCreateUserWithPassword: vi.fn(),
    mockRollbackAuthUser: vi.fn(),
    mockSendSetPasswordLink: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockTx: tx,
    mockPrisma: {
      profiles: { findFirst: vi.fn(), findUnique: vi.fn() },
      subscription_plans: { findFirst: vi.fn() },
      specialties: { findFirst: vi.fn() },
      clinics: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      tenant_subscriptions: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      payment_records: { create: vi.fn() },
      tenant_subscription_history: { create: vi.fn() },
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
  createUserAccount: mockCreateUserAccount,
  createUserAccountWithPassword: mockCreateUserWithPassword,
  rollbackAuthUser: mockRollbackAuthUser,
  sendSetPasswordLink: mockSendSetPasswordLink,
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
  assignTenantPlan,
  createTenant,
  rejectTenantRequest,
} from "../app-owner/tenants";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";
const AUTH_USER_ID = "44444444-4444-4444-8444-444444444444";
const SUB_ID = "55555555-5555-4555-8555-555555555555";
const SPECIALTY_ID = "66666666-6666-4666-8666-666666666666";

function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OWNER_ID,
    auth_user_id: AUTH_USER_ID,
    tenant_id: TENANT_ID,
    clinic_id: TENANT_ID,
    branch_id: null,
    full_name: "Dr. Sara Ali",
    email: "sara@clinic.com",
    phone: "+201001234567",
    specialty: null,
    role: "owner",
    is_owner: true,
    status: "inactive",
    is_profile_completed: false,
    created_at: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

function makeSubscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    tenant_id: AUTH_USER_ID,
    plan_id: PLAN_ID,
    plan: {
      id: PLAN_ID,
      name: "Pro",
      billing_period: "monthly",
      price: 99,
      currency: "USD",
    },
    start_date: new Date("2026-06-01T00:00:00Z"),
    end_date: null,
    renewal_date: null,
    activated_at: null,
    grace_period_days: 7,
    status: "pending_approval",
    billing_cycle: "monthly",
    price: 99,
    discount: null,
    currency: "USD",
    payment_status: "pending",
    payment_reference: null,
    notes: null,
    created_at: new Date("2026-06-01T00:00:00Z"),
    updated_at: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

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
      specialtyId: SPECIALTY_ID,
      planId: PLAN_ID,
    };

    it("rejects duplicate emails before creating an auth user", async () => {
      mockPrisma.profiles.findFirst.mockResolvedValueOnce({ id: OWNER_ID });
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
      });
      mockPrisma.specialties.findFirst.mockResolvedValueOnce({
        id: SPECIALTY_ID,
        name: "Dentistry",
      });

      const res = await requestTenantAccountAction(validRequest);
      expect(res).toEqual({
        error:
          "An account or request with this email already exists. Use Track Request Status or Sign In.",
      });
      expect(mockCreateUserWithPassword).not.toHaveBeenCalled();
    });

    it("rejects when selected clinic specialty is unavailable", async () => {
      mockPrisma.profiles.findFirst.mockResolvedValueOnce(null);
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
      });
      mockPrisma.specialties.findFirst.mockResolvedValueOnce(null);

      const res = await requestTenantAccountAction(validRequest);
      expect(res).toEqual({
        error: "Selected clinic specialty is not available.",
      });
      expect(mockCreateUserWithPassword).not.toHaveBeenCalled();
    });

    it("creates under_review clinic, stores subscription under authUserId, and returns scoped subscription + profile", async () => {
      mockPrisma.profiles.findFirst.mockResolvedValueOnce(null);
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
        billing_period: "monthly",
        price: 99,
        currency: "USD",
      });
      mockPrisma.specialties.findFirst.mockResolvedValueOnce({
        id: SPECIALTY_ID,
        name: "Dentistry",
      });
      mockCreateUserWithPassword.mockResolvedValueOnce({
        user: { id: AUTH_USER_ID },
      });
      mockTx.$queryRaw.mockResolvedValueOnce([{ nextval: BigInt(7) }]);
      mockTx.clinics.create.mockResolvedValueOnce({
        id: TENANT_ID,
        name: "Al Noor Clinic",
      });
      mockTx.profiles.upsert.mockResolvedValueOnce({ id: OWNER_ID });
      mockTx.profiles.findMany.mockResolvedValueOnce([{ id: "app-owner-1" }]);
      mockTx.profiles.findUnique.mockResolvedValueOnce(makeProfileRow());
      mockTx.tenant_subscriptions.findUnique.mockResolvedValueOnce(
        makeSubscriptionRow(),
      );

      const res = await requestTenantAccountAction(validRequest);

      expect(res).toMatchObject({
        success: true,
        clinicName: "Al Noor Clinic",
        email: "sara@clinic.com",
        subscription: {
          id: SUB_ID,
          tenant_id: AUTH_USER_ID,
          plan_id: PLAN_ID,
          status: "pending_approval",
          payment_status: "pending",
          plan: { id: PLAN_ID, name: "Pro", price: 99, currency: "USD" },
        },
        profile: {
          id: OWNER_ID,
          auth_user_id: AUTH_USER_ID,
          tenant_id: TENANT_ID,
          clinic_id: TENANT_ID,
          email: "sara@clinic.com",
          role: "owner",
          is_owner: true,
        },
      });
      if ("success" in res) {
        expect(res.requestRef).toMatch(/^REQ-\d{4}-0007$/);
      }
      expect(mockTx.tenant_subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: AUTH_USER_ID,
            status: "pending_approval",
            payment_status: "pending",
          }),
        }),
      );
      expect(mockTx.profiles.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { auth_user_id: AUTH_USER_ID } }),
      );
      expect(mockTx.tenant_subscriptions.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenant_id: AUTH_USER_ID } }),
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
      mockPrisma.specialties.findFirst.mockResolvedValueOnce({
        id: SPECIALTY_ID,
        name: "Dentistry",
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
    it("returns details only when both request_ref and owner email match and fetches subscription by owner auth_user_id", async () => {
      mockPrisma.clinics.findFirst.mockResolvedValueOnce({
        request_ref: "REQ-2026-0007",
        name: "Al Noor Clinic",
        status: "under_review",
        auth_user_id: AUTH_USER_ID,
        created_at: new Date("2026-06-01T00:00:00Z"),
        reviewed_at: null,
        rejection_reason: null,
        staff_profiles: [{ email: "sara@clinic.com", auth_user_id: AUTH_USER_ID }],
      });
      mockPrisma.tenant_subscriptions.findUnique.mockResolvedValueOnce({
        payment_status: "pending",
        start_date: new Date("2026-06-01T00:00:00Z"),
        end_date: null,
        plan: { name: "Pro" },
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
      expect(mockPrisma.tenant_subscriptions.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: AUTH_USER_ID },
        }),
      );

      mockPrisma.clinics.findFirst.mockResolvedValueOnce({
        request_ref: "REQ-2026-0007",
        staff_profiles: [{ email: "sara@clinic.com", auth_user_id: AUTH_USER_ID }],
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

  describe("createTenant", () => {
    it("creates tenant subscription keyed by authUserId and returns scoped subscription + profile", async () => {
      mockRequireAppOwner.mockResolvedValueOnce({
        id: "app-owner-1",
        role: "app_owner",
        email: "platform@clinic.com",
      });
      mockPrisma.profiles.findFirst.mockResolvedValueOnce(null);
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
        billing_period: "monthly",
        price: 99,
        currency: "USD",
      });
      mockCreateUserAccount.mockResolvedValueOnce({
        user: { id: AUTH_USER_ID },
        tempPassword: "TempPass!23",
      });
      mockTx.clinics.create.mockResolvedValueOnce({
        id: TENANT_ID,
        name: "Al Noor Clinic",
      });
      mockTx.profiles.upsert.mockResolvedValueOnce({ id: OWNER_ID });
      mockTx.branches.create.mockResolvedValueOnce({ id: "branch-1" });
      mockTx.profiles.findUnique.mockResolvedValueOnce(
        makeProfileRow({ status: "active", is_profile_completed: true }),
      );
      mockTx.tenant_subscriptions.findUnique.mockResolvedValueOnce(
        makeSubscriptionRow({ status: "active", payment_status: "paid" }),
      );

      const res = await createTenant({
        owner: {
          full_name: "Dr. Sara Ali",
          email: "sara@clinic.com",
          phone: "+201001234567",
        },
        clinic: {
          name: "Al Noor Clinic",
          registration_number: "",
          email: "",
          phone: "",
        },
        plan_id: PLAN_ID,
        branch: { name: "Main Branch", address: "", phone: "" },
        specialtyIds: [],
      });

      expect(res).toMatchObject({
        success: true,
        tenantId: TENANT_ID,
        tempPassword: "TempPass!23",
        ownerEmail: "sara@clinic.com",
        subscription: {
          tenant_id: AUTH_USER_ID,
          status: "active",
          payment_status: "paid",
        },
        profile: {
          auth_user_id: AUTH_USER_ID,
          tenant_id: TENANT_ID,
          status: "active",
          is_profile_completed: true,
        },
      });
      expect(mockTx.tenant_subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: AUTH_USER_ID,
            plan_id: PLAN_ID,
          }),
        }),
      );
    });
  });

  describe("approveTenantRequest, rejectTenantRequest & assignTenantPlan", () => {
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

    it("activates clinic, owner profile, Main Branch, subscription keyed by auth_user_id, and returns scoped snapshot", async () => {
      mockRequireAppOwner.mockResolvedValueOnce({
        id: "app-owner-1",
        role: "app_owner",
        email: "platform@clinic.com",
      });
      mockPrisma.clinics.findUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        status: "under_review",
        request_ref: "REQ-2026-0007",
        auth_user_id: AUTH_USER_ID,
        onboarding_completed_at: null,
        staff_profiles: [
          { id: OWNER_ID, email: "sara@clinic.com", auth_user_id: AUTH_USER_ID },
        ],
      });
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        id: PLAN_ID,
        name: "Pro",
        price: 99,
      });
      mockTx.clinic_branches.count.mockResolvedValueOnce(0);
      mockTx.branches.create.mockResolvedValueOnce({ id: "branch-1" });
      mockTx.tenant_subscriptions.upsert.mockResolvedValueOnce({ id: SUB_ID });
      mockTx.profiles.findUnique.mockResolvedValueOnce(
        makeProfileRow({ status: "active", is_profile_completed: true }),
      );
      mockTx.tenant_subscriptions.findUnique.mockResolvedValueOnce(
        makeSubscriptionRow({
          status: "active",
          payment_status: "paid",
          payment_reference: "TX-123",
        }),
      );

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

      expect(res).toMatchObject({
        success: true,
        subscription: {
          tenant_id: AUTH_USER_ID,
          status: "active",
          payment_status: "paid",
        },
        profile: {
          id: OWNER_ID,
          auth_user_id: AUTH_USER_ID,
          status: "active",
        },
      });
      expect(mockTx.tenant_subscriptions.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: AUTH_USER_ID },
          create: expect.objectContaining({ tenant_id: AUTH_USER_ID }),
        }),
      );
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

    it("rejects an under_review request, cancels subscription by auth_user_id, and returns scoped snapshot", async () => {
      mockRequireAppOwner.mockResolvedValueOnce({
        id: "app-owner-1",
        role: "app_owner",
        email: "platform@clinic.com",
      });
      mockPrisma.clinics.findUnique.mockResolvedValueOnce({
        id: TENANT_ID,
        status: "under_review",
        request_ref: "REQ-2026-0007",
        auth_user_id: AUTH_USER_ID,
        staff_profiles: [{ auth_user_id: AUTH_USER_ID }],
      });
      mockTx.profiles.findUnique.mockResolvedValueOnce(makeProfileRow());
      mockTx.tenant_subscriptions.findUnique.mockResolvedValueOnce(
        makeSubscriptionRow({ status: "cancelled" }),
      );

      const res = await rejectTenantRequest({
        tenantId: TENANT_ID,
        reason: "Missing license number",
      });

      expect(res).toMatchObject({
        success: true,
        subscription: {
          tenant_id: AUTH_USER_ID,
          status: "cancelled",
        },
        profile: {
          auth_user_id: AUTH_USER_ID,
        },
      });
      expect(mockTx.tenant_subscriptions.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: AUTH_USER_ID },
          data: expect.objectContaining({ status: "cancelled" }),
        }),
      );
    });

    it("assignTenantPlan updates subscription by owner auth_user_id and returns scoped snapshot", async () => {
      mockRequireAppOwner.mockResolvedValueOnce({
        id: "app-owner-1",
        role: "app_owner",
        email: "platform@clinic.com",
      });
      // 1st profiles.findUnique -> resolveTenantOwnerAuthId
      mockPrisma.profiles.findUnique.mockResolvedValueOnce({
        id: OWNER_ID,
        auth_user_id: AUTH_USER_ID,
        role: "owner",
        is_owner: true,
      });
      // 1st tenant_subscriptions.findUnique -> existing check
      mockPrisma.tenant_subscriptions.findUnique.mockResolvedValueOnce({
        id: SUB_ID,
        tenant_id: AUTH_USER_ID,
        payment_status: "pending",
        payment_reference: null,
        activated_at: null,
        start_date: new Date("2026-06-01T00:00:00Z"),
        end_date: null,
        grace_period_days: 7,
      });
      mockPrisma.tenant_subscriptions.update.mockResolvedValueOnce({
        id: SUB_ID,
        tenant_id: AUTH_USER_ID,
      });
      mockPrisma.subscription_plans.findFirst.mockResolvedValueOnce({
        name: "Pro",
        price: 99,
      });
      // 2nd profiles.findUnique & tenant_subscriptions.findUnique -> fetchTenantAccountSnapshot
      mockPrisma.profiles.findUnique.mockResolvedValueOnce(
        makeProfileRow({ status: "active", is_profile_completed: true }),
      );
      mockPrisma.tenant_subscriptions.findUnique.mockResolvedValueOnce(
        makeSubscriptionRow({ status: "active", payment_status: "paid" }),
      );

      const res = await assignTenantPlan({
        tenant_id: AUTH_USER_ID,
        plan_id: PLAN_ID,
        billing_cycle: "monthly",
        price: 99,
        currency: "USD",
        status: "active",
        payment_status: "paid",
      });

      expect(res).toMatchObject({
        success: true,
        subscription: {
          tenant_id: AUTH_USER_ID,
          status: "active",
          payment_status: "paid",
        },
        profile: {
          auth_user_id: AUTH_USER_ID,
        },
      });
      expect(mockPrisma.tenant_subscriptions.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: AUTH_USER_ID },
        }),
      );
      expect(mockPrisma.clinics.updateMany).toHaveBeenCalledWith({
        where: { auth_user_id: AUTH_USER_ID },
        data: { subscription_plan: "pro" },
      });
    });
  });
});
