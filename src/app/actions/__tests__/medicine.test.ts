import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  medications: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireTenantInfo: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  getClinicMedicines,
  createClinicMedicine,
  updateClinicMedicine,
  stopClinicMedicine,
  resumeClinicMedicine,
} from "@/app/actions/medicine";

const mockTenant = vi.mocked(requireTenantInfo);
const mockRevalidatePath = vi.mocked(revalidatePath);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const MED_ID = "33333333-3333-4333-8333-333333333333";

function makeTenant(role: string): Awaited<ReturnType<typeof requireTenantInfo>> {
  return {
    userId: "user-1",
    orgId: null,
    profileId: PROFILE_ID,
    role,
    fullName: "Dr. Test",
    email: "test@clinic.test",
    profileStatus: "active",
    is_profile_completed: true,
    is_owner: role === "owner",
    clinicId: CLINIC_ID,
    clinicName: "Test Clinic",
    clinicStatus: "active" as const,
    subscriptionPlan: "pro",
    branchId: null,
    branchName: null,
    branchLocked: false,
    auth_user_id: "user-1",
    access: { allowed: true as const, warning: null },
  };
}

function makeDbMedication(overrides: Record<string, unknown> = {}) {
  return {
    id: MED_ID,
    clinic_id: CLINIC_ID,
    generic_name: "Amoxicillin",
    brand_name: "Amoxil",
    category: "antibiotic",
    strength: "500mg",
    form: "Capsule",
    route: "Oral",
    default_dosage: "1 capsule",
    default_frequency: "Every 8 hours",
    default_duration: "7 days",
    default_quantity: 21,
    default_instructions: "Take after meals",
    manufacturer: "GSK",
    barcode: null,
    code: null,
    code_system: null,
    price: null,
    is_active: true,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    stopped_at: null,
    stopped_by: null,
    stop_reason: null,
    creator: { full_name: "Dr. Test" },
    stopper: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTenant.mockResolvedValue(makeTenant("doctor"));
});

describe("medicine module actions — strict doctor & owner RBAC", () => {
  const deniedRoles = [
    "admin",
    "super_admin",
    "staff",
    "pharmacist",
    "receptionist",
    "patient",
  ];

  it.each(deniedRoles)(
    "denies %s access to list, create, update, stop, and resume medicines",
    async (role) => {
      mockTenant.mockResolvedValue(makeTenant(role));

      expect(await getClinicMedicines()).toEqual({ error: "Unauthorized" });
      expect(
        await createClinicMedicine({ generic_name: "Amoxicillin" }),
      ).toEqual({ error: "Unauthorized" });
      expect(
        await updateClinicMedicine(MED_ID, { generic_name: "Amoxicillin" }),
      ).toEqual({ error: "Unauthorized" });
      expect(
        await stopClinicMedicine({ id: MED_ID, stop_reason: "Out of stock" }),
      ).toEqual({ error: "Unauthorized" });
      expect(await resumeClinicMedicine(MED_ID)).toEqual({
        error: "Unauthorized",
      });

      expect(prismaMock.medications.findMany).not.toHaveBeenCalled();
      expect(prismaMock.medications.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.medications.create).not.toHaveBeenCalled();
      expect(prismaMock.medications.update).not.toHaveBeenCalled();
    },
  );

  it.each(["doctor", "owner"])(
    "allows %s to list clinic medicines with counts",
    async (role) => {
      mockTenant.mockResolvedValue(makeTenant(role));
      prismaMock.medications.findMany.mockResolvedValue([
        makeDbMedication({ id: MED_ID, is_active: true }),
        makeDbMedication({
          id: "44444444-4444-4444-8444-444444444444",
          generic_name: "Ibuprofen",
          is_active: false,
          stopped_at: new Date(),
          stop_reason: "Replaced",
          stopper: { full_name: "Clinic Owner" },
        }),
      ]);

      const res = await getClinicMedicines({ status: "active" });

      expect(res).toMatchObject({
        success: true,
        data: {
          counts: { total: 2, active: 1, stopped: 1 },
        },
      });
      if ("data" in res) {
        expect(res.data.medicines).toHaveLength(1);
        expect(res.data.medicines[0].generic_name).toBe("Amoxicillin");
      }
      expect(prismaMock.medications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clinic_id: CLINIC_ID },
        }),
      );
    },
  );

  it("creates a clinic medicine with prescribing defaults and revalidates paths", async () => {
    mockTenant.mockResolvedValue(makeTenant("owner"));
    const created = makeDbMedication();
    prismaMock.medications.create.mockResolvedValue(created);

    const res = await createClinicMedicine({
      generic_name: "Amoxicillin",
      brand_name: "Amoxil",
      category: "antibiotic",
      strength: "500mg",
      form: "Capsule",
      route: "Oral",
      default_dosage: "1 capsule",
      default_frequency: "Every 8 hours",
      default_duration: "7 days",
      default_quantity: "21",
      default_instructions: "Take after meals",
      price: "",
    });

    expect(res).toMatchObject({
      success: true,
      data: {
        id: MED_ID,
        generic_name: "Amoxicillin",
        default_quantity: 21,
        price: null,
        is_active: true,
      },
    });
    expect(prismaMock.medications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinic_id: CLINIC_ID,
          created_by: PROFILE_ID,
          updated_by: PROFILE_ID,
          is_active: true,
        }),
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/doctor/medicines");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/medicines");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/doctor/prescriptions");
  });

  it("returns friendly error on duplicate generic_name + strength (P2002)", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique failed", {
      code: "P2002",
      clientVersion: "7.4.2",
    });
    prismaMock.medications.create.mockRejectedValue(p2002);

    const res = await createClinicMedicine({
      generic_name: "Amoxicillin",
      strength: "500mg",
    });

    expect(res).toEqual({
      error:
        "A medicine with this generic name and strength already exists in your clinic.",
    });
  });

  it("rejects updating a medicine from another clinic", async () => {
    prismaMock.medications.findFirst.mockResolvedValue(null);

    const res = await updateClinicMedicine(MED_ID, {
      generic_name: "Amoxicillin",
    });

    expect(res).toEqual({ error: "Medicine not found" });
    expect(prismaMock.medications.update).not.toHaveBeenCalled();
  });

  it("stops an active medicine with reason and audit trail, then resumes it", async () => {
    prismaMock.medications.findFirst.mockResolvedValue({
      id: MED_ID,
      is_active: true,
    });
    prismaMock.medications.update.mockResolvedValue(
      makeDbMedication({
        is_active: false,
        stopped_at: new Date("2026-02-01T00:00:00Z"),
        stopped_by: PROFILE_ID,
        stop_reason: "Supplier discontinued",
        stopper: { full_name: "Dr. Test" },
      }),
    );

    const stopRes = await stopClinicMedicine({
      id: MED_ID,
      stop_reason: "Supplier discontinued",
    });

    expect(stopRes).toMatchObject({
      success: true,
      data: {
        is_active: false,
        stop_reason: "Supplier discontinued",
        stopped_by_name: "Dr. Test",
      },
    });
    expect(prismaMock.medications.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MED_ID },
        data: expect.objectContaining({
          is_active: false,
          stopped_by: PROFILE_ID,
          stop_reason: "Supplier discontinued",
          stopped_at: expect.any(Date),
        }),
      }),
    );

    vi.clearAllMocks();
    mockTenant.mockResolvedValue(makeTenant("owner"));
    prismaMock.medications.findFirst.mockResolvedValue({
      id: MED_ID,
      is_active: false,
    });
    prismaMock.medications.update.mockResolvedValue(
      makeDbMedication({ is_active: true }),
    );

    const resumeRes = await resumeClinicMedicine(MED_ID);
    expect(resumeRes).toMatchObject({
      success: true,
      data: { is_active: true, stop_reason: null },
    });
    expect(prismaMock.medications.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MED_ID },
        data: expect.objectContaining({
          is_active: true,
          stopped_at: null,
          stopped_by: null,
          stop_reason: null,
        }),
      }),
    );
  });
});
