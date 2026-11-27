import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_PROFILE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF_PROFILE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLINIC_1 = "22222222-2222-4222-8222-222222222222";
const BRANCH_1 = "44444444-4444-4444-8444-444444444444";

const prismaMock = vi.hoisted(() => {
  const tx = {
    profiles: { update: vi.fn() },
    profile_branches: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  return {
    ...tx,
    clinics: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    clinic_branches: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    profiles: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    patients: {
      findFirst: vi.fn(),
    },
    profile_branches: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    specialties: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ requireTenantInfo: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/invitations", () => ({
  createUserAccount: vi.fn(),
  rollbackAuthUser: vi.fn(),
}));
vi.mock("@/features/rbac/services/rbac.service", () => ({
  rbacService: {
    getRoles: vi.fn(),
    assignUserRoles: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createUserAccount } from "@/lib/invitations";
import {
  getPersonnelPageData,
  upsertPersonnel,
  deletePersonnel,
} from "@/app/actions/personnel";

const mockTenant = vi.mocked(requireTenantInfo);
const mockPerm = vi.mocked(requirePermission);
const mockCreateUser = vi.mocked(createUserAccount);

beforeEach(() => {
  vi.clearAllMocks();
  mockPerm.mockResolvedValue(true);
  mockTenant.mockResolvedValue({
    userId: OWNER_ID,
    orgId: null,
    profileId: OWNER_PROFILE_ID,
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
    profileStatus: "active",
    clinicStatus: "active",
    access: { allowed: true, warning: null },
    auth_user_id: OWNER_ID,
  });

  prismaMock.clinics.findUnique.mockResolvedValue({ auth_user_id: OWNER_ID });
  prismaMock.clinics.findMany.mockResolvedValue([]);
  prismaMock.clinic_branches.findMany.mockResolvedValue([]);
  prismaMock.clinic_branches.findFirst.mockResolvedValue({ id: "link-1" });
  prismaMock.profiles.findMany.mockResolvedValue([]);
  prismaMock.profiles.findFirst.mockResolvedValue(null);
  prismaMock.patients.findFirst.mockResolvedValue(null);
  prismaMock.specialties.findMany.mockResolvedValue([]);
});

describe("getPersonnelPageData", () => {
  it("loads tenant, personnel, owner clinics, branches, and skips specialties for staff", async () => {
    prismaMock.profiles.findMany.mockResolvedValue([
      {
        id: STAFF_PROFILE_ID,
        full_name: "Staff Member",
        role: "staff",
        branches: { id: BRANCH_1, name: "Main Branch" },
        profile_branches: [],
      },
    ]);
    prismaMock.clinics.findMany
      .mockResolvedValueOnce([{ id: CLINIC_1, name: "Clinic One", is_primary: true }])
      .mockResolvedValueOnce([
        {
          id: CLINIC_1,
          name: "Clinic One",
          is_primary: true,
          clinic_branches: [
            {
              is_primary: true,
              branches: { id: BRANCH_1, name: "Main Branch", address: null },
            },
          ],
        },
      ]);
    prismaMock.clinic_branches.findMany.mockResolvedValue([
      {
        is_primary: true,
        branches: {
          id: BRANCH_1,
          name: "Main Branch",
          address: null,
          phone: null,
          status: "active",
          created_at: new Date(),
        },
      },
    ]);

    const res = await getPersonnelPageData("staff");

    expect(mockTenant).toHaveBeenCalledTimes(1);
    expect(res.personnel).toHaveLength(1);
    expect(res.ownerClinics).toHaveLength(1);
    expect(res.ownerClinicsWithBranches[0].branches).toHaveLength(1);
    expect(res.branches).toHaveLength(1);
    expect(res.specialties).toEqual([]);
    expect(prismaMock.specialties.findMany).not.toHaveBeenCalled();
  });

  it("loads active specialties when page is doctor", async () => {
    prismaMock.specialties.findMany.mockResolvedValue([
      { id: "spec-1", name: "Ophthalmology", name_ar: "طب العيون", diagram_key: "eye" },
    ]);

    const res = await getPersonnelPageData("doctor");

    expect(prismaMock.specialties.findMany).toHaveBeenCalledTimes(1);
    expect(res.specialties).toHaveLength(1);
  });
});

describe("upsertPersonnel", () => {
  it("returns { error } instead of throwing on validation failure", async () => {
    const res = await upsertPersonnel({
      full_name: "A",
      email: "invalid-email",
      role: "staff",
      status: "active",
    });

    expect(res).toEqual({ error: expect.any(String) });
  });

  it("returns { error } instead of throwing when a duplicate clinic email exists", async () => {
    prismaMock.profiles.findFirst.mockResolvedValue({
      email: "dup@test.io",
      phone: null,
    });

    const res = await upsertPersonnel({
      full_name: "Jane Staff",
      email: "dup@test.io",
      role: "staff",
      status: "active",
      branch_id: BRANCH_1,
    });

    expect(res).toEqual({
      error: "A user with this email already exists in this clinic.",
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("returns { error } instead of throwing when Supabase admin key check fails", async () => {
    mockCreateUser.mockRejectedValue(
      new Error(
        "Invalid SUPABASE_SERVICE_ROLE_KEY: a public/anon key was provided instead of a service_role or sb_secret_ key.",
      ),
    );

    const res = await upsertPersonnel({
      full_name: "Jane Staff",
      email: "jane@test.io",
      role: "staff",
      status: "active",
      branch_id: BRANCH_1,
    });

    expect(res).toEqual({
      error: expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY"),
    });
  });
});

describe("deletePersonnel", () => {
  it("returns { error } when profile is not in the acting tenant", async () => {
    prismaMock.profiles.findFirst.mockResolvedValue(null);

    const res = await deletePersonnel(STAFF_PROFILE_ID);

    expect(res).toEqual({ error: "Profile not found in this clinic." });
    expect(prismaMock.profiles.delete).not.toHaveBeenCalled();
  });

  it("blocks deleting an owner profile", async () => {
    prismaMock.profiles.findFirst.mockResolvedValue({
      id: OWNER_PROFILE_ID,
      role: "owner",
      is_owner: true,
    });

    const res = await deletePersonnel(OWNER_PROFILE_ID);

    expect(res).toEqual({ error: "Clinic owner profiles cannot be deleted." });
    expect(prismaMock.profiles.delete).not.toHaveBeenCalled();
  });

  it("returns a friendly { error } on Prisma P2003 foreign key constraint violation", async () => {
    prismaMock.profiles.findFirst.mockResolvedValue({
      id: STAFF_PROFILE_ID,
      role: "staff",
      is_owner: false,
    });
    prismaMock.profiles.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("FK constraint", {
        code: "P2003",
        clientVersion: "7.4.2",
      }),
    );

    const res = await deletePersonnel(STAFF_PROFILE_ID);

    expect(res).toEqual({
      error: expect.stringContaining("linked to existing clinic records"),
    });
  });

  it("deletes a valid clinic staff profile and returns { success: true }", async () => {
    prismaMock.profiles.findFirst.mockResolvedValue({
      id: STAFF_PROFILE_ID,
      role: "staff",
      is_owner: false,
    });
    prismaMock.profiles.delete.mockResolvedValue({ id: STAFF_PROFILE_ID });

    const res = await deletePersonnel(STAFF_PROFILE_ID);

    expect(prismaMock.profiles.delete).toHaveBeenCalledWith({
      where: { id: STAFF_PROFILE_ID },
    });
    expect(res).toEqual({ success: true });
  });
});
