import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireTenantInfo,
  mockGetTenantInfo,
  mockRequirePermission,
  mockPatientsFindFirst,
  mockAdminUpdateUserById,
  mockAdminGetUserById,
  mockGenerateTempPassword,
} = vi.hoisted(() => ({
  mockRequireTenantInfo: vi.fn(),
  mockGetTenantInfo: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockPatientsFindFirst: vi.fn(),
  mockAdminUpdateUserById: vi.fn(),
  mockAdminGetUserById: vi.fn(),
  mockGenerateTempPassword: vi.fn(() => "TmpPass1234!"),
}));

vi.mock("@/lib/auth", () => ({
  requireTenantInfo: mockRequireTenantInfo,
  getTenantInfo: mockGetTenantInfo,
}));

vi.mock("@/lib/permissions", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/invitations", () => ({
  createUserAccount: vi.fn(),
  rollbackAuthUser: vi.fn(),
}));

vi.mock("@/lib/patient-auth", () => ({
  requireCurrentPatient: vi.fn(),
}));

vi.mock("@/lib/user-creation", () => ({
  findClinicDuplicate: vi.fn(),
  duplicateMessage: vi.fn(),
  generateTempPassword: mockGenerateTempPassword,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: {
      admin: {
        updateUserById: mockAdminUpdateUserById,
        getUserById: mockAdminGetUserById,
      },
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patients: {
      findFirst: mockPatientsFindFirst,
    },
  },
}));

import {
  canManagePatientPasswords,
  resetPatientPassword,
  setPatientPassword,
} from "../patient";

describe("patient password management actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateTempPassword.mockReturnValue("TmpPass1234!");
    mockAdminUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null });
    mockPatientsFindFirst.mockResolvedValue({
      id: "patient-1",
      clinic_id: "clinic-1",
      profile_id: "profile-1",
      profiles: { id: "profile-1", auth_user_id: "auth-user-1" },
    });
  });

  it("rejects receptionist/staff roles from resetting or setting passwords", async () => {
    mockRequireTenantInfo.mockResolvedValue({
      clinicId: "clinic-1",
      role: "receptionist",
      is_owner: false,
    });
    mockGetTenantInfo.mockResolvedValue({
      clinicId: "clinic-1",
      role: "receptionist",
      is_owner: false,
    });

    expect(await canManagePatientPasswords()).toBe(false);

    const resetRes = await resetPatientPassword("patient-1");
    expect("error" in resetRes).toBe(true);
    if ("error" in resetRes) {
      expect(resetRes.error).toMatch(/Forbidden/i);
    }

    const setRes = await setPatientPassword("patient-1", {
      password: "Password123",
      confirm: "Password123",
    });
    expect("error" in setRes).toBe(true);
    if ("error" in setRes) {
      expect(setRes.error).toMatch(/Forbidden/i);
    }
    expect(mockAdminUpdateUserById).not.toHaveBeenCalled();
  });

  it("allows clinic owners to generate a temporary password", async () => {
    mockRequireTenantInfo.mockResolvedValue({
      clinicId: "clinic-1",
      role: "admin",
      is_owner: true,
    });

    const result = await resetPatientPassword("patient-1");
    expect(result).toEqual({ success: true, tempPassword: "TmpPass1234!" });
    expect(mockAdminUpdateUserById).toHaveBeenCalledWith("auth-user-1", {
      password: "TmpPass1234!",
    });
  });

  it("allows doctors to set a valid custom password", async () => {
    mockRequireTenantInfo.mockResolvedValue({
      clinicId: "clinic-1",
      role: "doctor",
      is_owner: false,
    });
    mockGetTenantInfo.mockResolvedValue({
      clinicId: "clinic-1",
      role: "doctor",
      is_owner: false,
    });

    expect(await canManagePatientPasswords()).toBe(true);

    const result = await setPatientPassword("patient-1", {
      password: "NewPassword9",
      confirm: "NewPassword9",
    });
    expect(result).toEqual({ success: true });
    expect(mockAdminUpdateUserById).toHaveBeenCalledWith("auth-user-1", {
      password: "NewPassword9",
    });
  });

  it("rejects weak or mismatched custom passwords", async () => {
    mockRequireTenantInfo.mockResolvedValue({
      clinicId: "clinic-1",
      role: "doctor",
      is_owner: false,
    });

    const weakRes = await setPatientPassword("patient-1", {
      password: "short",
      confirm: "short",
    });
    expect("error" in weakRes).toBe(true);

    const mismatchRes = await setPatientPassword("patient-1", {
      password: "Password123",
      confirm: "Password456",
    });
    expect("error" in mismatchRes).toBe(true);
    expect(mockAdminUpdateUserById).not.toHaveBeenCalled();
  });

  it("rejects patients who do not have a portal account yet", async () => {
    mockRequireTenantInfo.mockResolvedValue({
      clinicId: "clinic-1",
      role: "owner",
      is_owner: true,
    });
    mockPatientsFindFirst.mockResolvedValue({
      id: "patient-2",
      clinic_id: "clinic-1",
      profile_id: null,
      profiles: null,
    });

    const res = await resetPatientPassword("patient-2");
    expect(res).toEqual({
      error: "This patient does not have a portal account yet.",
    });
    expect(mockAdminUpdateUserById).not.toHaveBeenCalled();
  });
});
