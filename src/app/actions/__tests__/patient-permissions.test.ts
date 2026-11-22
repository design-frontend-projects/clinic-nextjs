import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  profiles: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  patients: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireTenantInfo: vi.fn(),
  getTenantInfo: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/invitations", () => ({
  createUserAccount: vi.fn(),
  rollbackAuthUser: vi.fn(),
}));
vi.mock("@/lib/patient-auth", () => ({
  requireCurrentPatient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { createPatient, updatePatient } from "@/app/actions/admin";
import { invitePatientToPortal } from "@/app/actions/patient";
import { resolveNavItems } from "@/components/layout/nav.config";

const mockTenant = vi.mocked(requireTenantInfo);
const mockRequirePermission = vi.mocked(requirePermission);
const mockRevalidatePath = vi.mocked(revalidatePath);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(true);
  mockTenant.mockResolvedValue({
    userId: "user-1",
    orgId: null,
    profileId: "profile-1",
    role: "staff",
    fullName: "Staff User",
    email: "staff@clinic.test",
    is_profile_completed: true,
    is_owner: false,
    clinicId: CLINIC_ID,
    clinicName: "Test Clinic",
    subscriptionPlan: "pro",
    branchId: BRANCH_ID,
    branchName: "Main Branch",
    branchLocked: true,
    auth_user_id: "user-1",
  });
  prismaMock.profiles.findFirst.mockResolvedValue(null);
  prismaMock.patients.findFirst.mockResolvedValue(null);
});

describe("patient server action permissions & contracts", () => {
  it("checks patient.create (never patient.manage) and returns { success, patient } on valid createPatient", async () => {
    const created = {
      id: PATIENT_ID,
      clinic_id: CLINIC_ID,
      branch_id: BRANCH_ID,
      first_name: "Sara",
      last_name: "Ali",
      email: "sara@example.com",
      phone: "01001234567",
      gender: "female",
      date_of_birth: null,
      address: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      profile_id: null,
    };
    prismaMock.patients.create.mockResolvedValue(created);

    const result = await createPatient({
      first_name: "Sara",
      last_name: "Ali",
      email: "sara@example.com",
      phone: "01001234567",
      gender: "female",
    });

    expect(mockRequirePermission).toHaveBeenCalledWith("patient.create");
    expect(mockRequirePermission).not.toHaveBeenCalledWith("patient.manage");
    expect(result).toEqual({ success: true, patient: created });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/patients");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/staff/patients");
  });

  it("returns { error } cleanly without throwing when permission is missing", async () => {
    mockRequirePermission.mockRejectedValue(
      new Error("Forbidden: Missing required permission (patient.create)"),
    );

    const result = await createPatient({
      first_name: "Sara",
      last_name: "Ali",
    });

    expect(result).toEqual({
      error: "Forbidden: Missing required permission (patient.create)",
    });
    expect(prismaMock.patients.create).not.toHaveBeenCalled();
  });

  it("rejects invalid Zod payload without calling Prisma", async () => {
    const result = await createPatient({
      first_name: "   ",
      last_name: "Ali",
      email: "not-an-email",
    });

    expect(result).toEqual({ error: "First name is required" });
    expect(prismaMock.profiles.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.patients.create).not.toHaveBeenCalled();
  });

  it("returns { error } when a duplicate clinic contact exists", async () => {
    prismaMock.patients.findFirst.mockResolvedValue({
      email: "sara@example.com",
      phone: null,
    });

    const result = await createPatient({
      first_name: "Sara",
      last_name: "Ali",
      email: "sara@example.com",
    });

    expect(result).toEqual({
      error: "A patient with this email already exists in this clinic.",
    });
    expect(prismaMock.patients.create).not.toHaveBeenCalled();
  });

  it("requires patient.update in updatePatient", async () => {
    prismaMock.patients.update.mockResolvedValue({ id: PATIENT_ID });

    await updatePatient(PATIENT_ID, { first_name: "Updated" });

    expect(mockRequirePermission).toHaveBeenCalledWith("patient.update");
    expect(mockRequirePermission).not.toHaveBeenCalledWith("patient.manage");
  });

  it("requires patient.update in invitePatientToPortal", async () => {
    prismaMock.patients.findFirst.mockResolvedValue(null);

    const result = await invitePatientToPortal(PATIENT_ID);

    expect(mockRequirePermission).toHaveBeenCalledWith("patient.update");
    expect(mockRequirePermission).not.toHaveBeenCalledWith("patient.manage");
    expect(result).toEqual({ error: "Patient not found." });
  });
});

describe("receptionist navigation", () => {
  it("resolves /staff sidebar items including /staff/patients for receptionist", async () => {
    const items = await resolveNavItems("receptionist", async () => true);
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain("/staff");
    expect(hrefs).toContain("/staff/patients");
    expect(hrefs).toContain("/staff/booking");
    expect(hrefs).toContain("/staff/checkin");
  });
});
