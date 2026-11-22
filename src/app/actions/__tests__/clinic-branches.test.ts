import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CLINIC_1 = "22222222-2222-4222-8222-222222222222";
const CLINIC_2 = "33333333-3333-4333-8333-333333333333";
const BRANCH_1 = "44444444-4444-4444-8444-444444444444";
const BRANCH_2 = "55555555-5555-4555-8555-555555555555";

const prismaMock = vi.hoisted(() => {
  const tx = {
    clinics: {
      create: vi.fn(),
      update: vi.fn(),
    },
    branches: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    clinic_branches: {
      create: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    ...tx,
    clinics: {
      ...tx.clinics,
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    branches: {
      ...tx.branches,
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    clinic_branches: {
      ...tx.clinic_branches,
      findMany: vi.fn(),
    },
    appointments: { count: vi.fn() },
    profiles: { count: vi.fn() },
    profile_branches: { count: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    _tx: tx,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ requireTenantInfo: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requirePermission: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  upsertBranch,
  createClinic,
  unlinkBranchFromClinic,
  deleteBranch,
} from "@/app/actions/clinic";

const mockTenant = vi.mocked(requireTenantInfo);
const mockPerm = vi.mocked(requirePermission);

beforeEach(() => {
  vi.clearAllMocks();
  mockPerm.mockResolvedValue(undefined as never);
  mockTenant.mockResolvedValue({
    userId: OWNER_ID,
    orgId: null,
    profileId: "prof-1",
    role: "owner",
    fullName: "Owner",
    email: "owner@test.io",
    is_profile_completed: true,
    is_owner: true,
    clinicId: CLINIC_1,
    clinicName: "Clinic One",
    subscriptionPlan: "pro",
    branchId: BRANCH_1,
    branchName: "Main Branch",
    branchLocked: false,
    auth_user_id: OWNER_ID,
  });

  prismaMock.clinics.findUnique.mockResolvedValue({ auth_user_id: OWNER_ID });
  prismaMock.clinics.findMany.mockResolvedValue([
    { id: CLINIC_1 },
    { id: CLINIC_2 },
  ]);
  prismaMock.appointments.count.mockResolvedValue(0);
  prismaMock.profiles.count.mockResolvedValue(0);
  prismaMock.profile_branches.count.mockResolvedValue(0);
});

describe("upsertBranch", () => {
  it("creates a new owner-level branch via create (never calling upsert with 'new-id')", async () => {
    prismaMock.branches.findFirst.mockResolvedValue(null);
    prismaMock._tx.branches.create.mockResolvedValue({
      id: BRANCH_1,
      owner_id: OWNER_ID,
      clinic_id: null,
      name: "Downtown Branch",
      address: "123 Main St",
      phone: "555-0100",
      status: "active",
    });

    const result = await upsertBranch({
      name: "  Downtown Branch  ",
      address: "123 Main St",
      phone: "555-0100",
      status: "active",
    });

    expect(result.name).toBe("Downtown Branch");
    expect(prismaMock.branches.upsert).not.toHaveBeenCalled();
    expect(prismaMock._tx.branches.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock._tx.branches.create.mock.calls[0][0];
    expect(createArgs.data.owner_id).toBe(OWNER_ID);
    expect(createArgs.data.name).toBe("Downtown Branch");
    expect(createArgs.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects an invalid UUID id (such as 'new-id') cleanly before hitting Prisma", async () => {
    await expect(
      upsertBranch({
        id: "new-id",
        name: "Downtown Branch",
        status: "active",
      }),
    ).rejects.toThrow(/uuid/i);

    expect(prismaMock._tx.branches.create).not.toHaveBeenCalled();
    expect(prismaMock.branches.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate case-insensitive branch names for the same owner", async () => {
    prismaMock.branches.findFirst.mockResolvedValueOnce({ id: BRANCH_1 });

    await expect(
      upsertBranch({
        name: "downtown branch",
        status: "active",
      }),
    ).rejects.toThrow("A branch with this name already exists");

    expect(prismaMock._tx.branches.create).not.toHaveBeenCalled();
  });

  it("updates an existing branch when a valid UUID id is provided", async () => {
    // 1st findFirst: duplicate check -> null; 2nd findFirst: ownership check -> found
    prismaMock.branches.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: BRANCH_1 });
    prismaMock.branches.update.mockResolvedValue({
      id: BRANCH_1,
      name: "Uptown Branch",
      status: "active",
    });

    const result = await upsertBranch({
      id: BRANCH_1,
      name: "Uptown Branch",
      status: "active",
    });

    expect(result.name).toBe("Uptown Branch");
    expect(prismaMock.branches.update).toHaveBeenCalledWith({
      where: { id: BRANCH_1 },
      data: {
        name: "Uptown Branch",
        address: null,
        phone: null,
        status: "active",
      },
    });
  });

  it("translates Prisma P2002 unique violation into a friendly error", async () => {
    prismaMock.branches.findFirst.mockResolvedValue(null);
    prismaMock._tx.branches.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique failed", {
        code: "P2002",
        clientVersion: "7.4.2",
      }),
    );

    await expect(
      upsertBranch({ name: "Maadi", status: "active" }),
    ).rejects.toThrow("A branch with this name already exists");
  });
});

describe("createClinic", () => {
  it("links selected owner branches via clinic_branches without auto-creating Main Branch", async () => {
    prismaMock.branches.findMany.mockResolvedValue([
      { id: BRANCH_1 },
      { id: BRANCH_2 },
    ]);
    prismaMock._tx.clinics.create.mockResolvedValue({
      id: CLINIC_2,
      name: "Dental Clinic",
    });

    await createClinic({
      name: "Dental Clinic",
      status: "trial",
      have_pharmacy: false,
      have_lab: false,
      have_radio_center: false,
      branch_ids: [BRANCH_1, BRANCH_2],
      primary_branch_id: BRANCH_2,
    });

    expect(prismaMock._tx.branches.create).not.toHaveBeenCalled();
    expect(prismaMock._tx.clinics.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          auth_user_id: OWNER_ID,
          name: "Dental Clinic",
        }),
      }),
    );
    expect(prismaMock._tx.clinic_branches.createMany).toHaveBeenCalledWith({
      data: [
        { clinic_id: CLINIC_2, branch_id: BRANCH_1, is_primary: false },
        { clinic_id: CLINIC_2, branch_id: BRANCH_2, is_primary: true },
      ],
    });
  });

  it("rejects creating a clinic without at least one branch", async () => {
    await expect(
      createClinic({
        name: "Dental Clinic",
        status: "trial",
        have_pharmacy: false,
        have_lab: false,
        have_radio_center: false,
        branch_ids: [],
      }),
    ).rejects.toThrow(/at least one branch/i);
  });
});

describe("unlinkBranchFromClinic & deleteBranch guards", () => {
  it("blocks unlinking the last remaining branch of a clinic", async () => {
    prismaMock.clinic_branches.findMany.mockResolvedValue([
      { id: "link-1", clinic_id: CLINIC_1, branch_id: BRANCH_1, is_primary: true },
    ]);

    await expect(
      unlinkBranchFromClinic(CLINIC_1, BRANCH_1),
    ).rejects.toThrow(/at least one branch/i);
  });

  it("blocks deleting a branch that is the only branch of a clinic", async () => {
    prismaMock.branches.findFirst.mockResolvedValue({ id: BRANCH_1 });
    prismaMock.clinic_branches.findMany.mockResolvedValue([
      {
        id: "link-1",
        clinic_id: CLINIC_1,
        branch_id: BRANCH_1,
        is_primary: true,
        clinics: {
          id: CLINIC_1,
          name: "Clinic One",
          _count: { clinic_branches: 1 },
        },
      },
    ]);

    await expect(deleteBranch(BRANCH_1)).rejects.toThrow(
      /only branch for "Clinic One"/i,
    );
    expect(prismaMock._tx.branches.delete).not.toHaveBeenCalled();
  });

  it("blocks deleting a branch with future appointments", async () => {
    prismaMock.branches.findFirst.mockResolvedValue({ id: BRANCH_1 });
    prismaMock.appointments.count.mockResolvedValue(2);

    await expect(deleteBranch(BRANCH_1)).rejects.toThrow(
      /future appointments/i,
    );
  });

  it("blocks deleting a branch with assigned staff", async () => {
    prismaMock.branches.findFirst.mockResolvedValue({ id: BRANCH_1 });
    prismaMock.profile_branches.count.mockResolvedValue(1);

    await expect(deleteBranch(BRANCH_1)).rejects.toThrow(/assigned staff/i);
  });
});
