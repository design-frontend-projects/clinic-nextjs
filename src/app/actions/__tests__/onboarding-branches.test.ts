import { describe, it, expect, vi, beforeEach } from "vitest";

const AUTH_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const CLINIC_ID = "33333333-3333-4333-8333-333333333333";
const BRANCH_1 = "44444444-4444-4444-8444-444444444444";
const BRANCH_2 = "55555555-5555-4555-8555-555555555555";
const PLAN_ID = "66666666-6666-4666-8666-666666666666";

const cookieSetMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => {
  const tx = {
    branches: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    clinics: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    clinic_branches: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    profiles: {
      update: vi.fn(),
    },
    doctor_specialties: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    ...tx,
    profiles: {
      ...tx.profiles,
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    subscription_plans: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    tenant_subscriptions: {
      upsert: vi.fn(),
    },
    specialties: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    _tx: tx,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ getSupabaseSession: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock })),
}));
vi.mock("@/lib/cookie-options", () => ({
  isSecureCookieContext: vi.fn(async () => false),
}));

import { getSupabaseSession } from "@/lib/auth";
import {
  getOnboardingProgress,
  saveOnboardingBranchesStep,
  saveClinicStep,
  saveSpecialtiesStep,
} from "@/app/actions/onboarding";

const mockSession = vi.mocked(getSupabaseSession);

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue({
    user: { id: AUTH_ID } as never,
  });
});

describe("getOnboardingProgress (reordered flow)", () => {
  it("starts at subscription when profile exists with no branches and no clinic", async () => {
    prismaMock.profiles.findUnique.mockResolvedValue({
      id: PROFILE_ID,
      full_name: "Dr. Owner",
      email: "owner@test.io",
      phone: null,
      role: "owner",
      specialty: null,
      is_profile_completed: false,
    });
    prismaMock.branches.findMany.mockResolvedValue([]);
    prismaMock.clinics.findFirst.mockResolvedValue(null);

    const res = await getOnboardingProgress();
    expect(res).toMatchObject({ step: "subscription" });
  });

  it("resumes at clinic with saved branches when owner defined branches already", async () => {
    prismaMock.profiles.findUnique.mockResolvedValue({
      id: PROFILE_ID,
      full_name: "Dr. Owner",
      email: "owner@test.io",
      phone: null,
      role: "owner",
      specialty: null,
      is_profile_completed: false,
    });
    prismaMock.branches.findMany.mockResolvedValue([
      { id: BRANCH_1, name: "Downtown", address: "123 St", phone: null },
    ]);
    prismaMock.clinics.findFirst.mockResolvedValue(null);

    const res = await getOnboardingProgress();
    expect(res).toMatchObject({
      step: "clinic",
      data: {
        branches: [{ id: BRANCH_1, name: "Downtown", address: "123 St", phone: "" }],
      },
    });
  });

  it("resumes at specialties when clinic exists with branches but onboarding is incomplete", async () => {
    prismaMock.profiles.findUnique.mockResolvedValue({
      id: PROFILE_ID,
      full_name: "Dr. Owner",
      email: "owner@test.io",
      phone: null,
      role: "owner",
      specialty: null,
      is_profile_completed: false,
    });
    prismaMock.branches.findMany.mockResolvedValue([
      { id: BRANCH_1, name: "Downtown", address: null, phone: null },
    ]);
    prismaMock.clinics.findFirst.mockResolvedValue({
      id: CLINIC_ID,
      name: "Acme Clinic",
      registration_number: null,
      email: null,
      phone: null,
      subscription_plan: "pro",
      is_primary: true,
      onboarding_completed_at: null,
      clinic_branches: [{ branch_id: BRANCH_1, is_primary: true }],
    });
    prismaMock.doctor_specialties.findMany.mockResolvedValue([]);

    const res = await getOnboardingProgress();
    expect(res).toMatchObject({
      step: "specialties",
      data: {
        clinicId: CLINIC_ID,
        clinicData: {
          branch_ids: [BRANCH_1],
          primary_branch_id: BRANCH_1,
        },
      },
    });
  });
});

describe("saveOnboardingBranchesStep", () => {
  it("saves multiple owner branches before clinic setup", async () => {
    prismaMock._tx.branches.findMany.mockResolvedValue([]);
    prismaMock._tx.branches.create
      .mockResolvedValueOnce({
        id: BRANCH_1,
        name: "Downtown",
        address: "Addr 1",
        phone: null,
      })
      .mockResolvedValueOnce({
        id: BRANCH_2,
        name: "Maadi",
        address: null,
        phone: "555-2222",
      });

    const res = await saveOnboardingBranchesStep([
      { name: "Downtown", address: "Addr 1" },
      { name: "Maadi", phone: "555-2222" },
    ]);

    expect(res).toEqual({
      success: true,
      branches: [
        { id: BRANCH_1, name: "Downtown", address: "Addr 1", phone: "" },
        { id: BRANCH_2, name: "Maadi", address: "", phone: "555-2222" },
      ],
    });
    expect(prismaMock._tx.branches.create).toHaveBeenCalledTimes(2);
    expect(prismaMock._tx.branches.create.mock.calls[0][0].data).toMatchObject({
      owner_id: AUTH_ID,
      clinic_id: null,
    });
  });

  it("rejects case-insensitive duplicate branch names", async () => {
    const res = await saveOnboardingBranchesStep([
      { name: "Downtown" },
      { name: "downtown" },
    ]);

    expect(res).toEqual({ error: 'Duplicate branch name: "downtown"' });
    expect(prismaMock._tx.branches.create).not.toHaveBeenCalled();
  });

  it("creates a default Main Branch when skipped (empty list)", async () => {
    prismaMock._tx.branches.findMany.mockResolvedValue([]);
    prismaMock._tx.branches.create.mockResolvedValue({
      id: BRANCH_1,
      name: "Main Branch",
      address: null,
      phone: null,
    });

    const res = await saveOnboardingBranchesStep([]);
    expect(res).toEqual({
      success: true,
      branches: [{ id: BRANCH_1, name: "Main Branch", address: "", phone: "" }],
    });
  });
});

describe("saveClinicStep & saveSpecialtiesStep", () => {
  it("links selected owner branches to the clinic and sets active_branch_id cookie", async () => {
    prismaMock.branches.findMany.mockResolvedValue([
      { id: BRANCH_1 },
      { id: BRANCH_2 },
    ]);
    prismaMock._tx.clinics.findFirst.mockResolvedValue(null);
    prismaMock._tx.clinics.create.mockResolvedValue({
      id: CLINIC_ID,
      name: "Acme Clinic",
    });
    prismaMock.subscription_plans.findFirst.mockResolvedValue({
      id: PLAN_ID,
      name: "Pro",
      billing_period: "monthly",
      price: 99,
    });

    const res = await saveClinicStep(
      {
        name: "Acme Clinic",
        branch_ids: [BRANCH_1, BRANCH_2],
        primary_branch_id: BRANCH_2,
      },
      { plan_id: PLAN_ID },
    );

    expect(res).toEqual({ success: true, clinicId: CLINIC_ID });
    expect(prismaMock._tx.clinic_branches.upsert).toHaveBeenCalledTimes(2);
    expect(cookieSetMock).toHaveBeenCalledWith(
      "active_branch_id",
      BRANCH_2,
      expect.any(Object),
    );
  });

  it("completes onboarding on saveSpecialtiesStep", async () => {
    prismaMock.profiles.findUnique.mockResolvedValue({ id: PROFILE_ID });
    prismaMock.clinics.findFirst.mockResolvedValue({
      id: CLINIC_ID,
      clinic_branches: [{ branch_id: BRANCH_1 }],
    });
    prismaMock._tx.doctor_specialties.findMany.mockResolvedValue([]);

    const res = await saveSpecialtiesStep([]);

    expect(res).toEqual({ success: true, specialtyIds: [] });
    expect(prismaMock._tx.clinics.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CLINIC_ID },
        data: { onboarding_completed_at: expect.any(Date) },
      }),
    );
    expect(prismaMock._tx.profiles.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auth_user_id: AUTH_ID },
        data: { is_profile_completed: true },
      }),
    );
    expect(cookieSetMock).toHaveBeenCalledWith(
      "onboarding_complete",
      "1",
      expect.any(Object),
    );
  });
});
