import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  medications: {
    findMany: vi.fn(),
  },
  patients: {
    findFirst: vi.fn(),
  },
  prescriptions: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  prescription_items: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireTenantInfo: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireTenantInfo } from "@/lib/auth";
import {
  getPrescriptionCatalog,
  createPrescription,
  updatePrescription,
} from "@/app/actions/prescription";
import {
  buildPrescriptionDefaultsFromMedicine,
  formatMedicineLabel,
} from "@/types/medication.types";

const mockTenant = vi.mocked(requireTenantInfo);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const MED_ACTIVE_ID = "44444444-4444-4444-8444-444444444444";
const MED_STOPPED_ID = "55555555-5555-4555-8555-555555555555";
const RX_ID = "66666666-6666-4666-8666-666666666666";

function makeTenant(role: string): Awaited<ReturnType<typeof requireTenantInfo>> {
  return {
    userId: "user-1",
    orgId: null,
    profileId: PROFILE_ID,
    role,
    fullName: "Dr. Test",
    email: "doctor@clinic.test",
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

beforeEach(() => {
  vi.clearAllMocks();
  mockTenant.mockResolvedValue(makeTenant("doctor"));
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops);
});

describe("prescription medicine catalog wiring", () => {
  it("formats labels and maps prescribing defaults cleanly", () => {
    const med = {
      id: MED_ACTIVE_ID,
      generic_name: "Amoxicillin",
      brand_name: "Amoxil",
      category: "antibiotic",
      strength: "500mg",
      form: "Capsule",
      route: "Oral",
      default_dosage: "1 capsule",
      default_frequency: "3x daily",
      default_duration: "7 days",
      default_quantity: 21,
      default_instructions: "Take after meals",
    };

    expect(formatMedicineLabel(med)).toBe("Amoxil (Amoxicillin) 500mg");
    expect(buildPrescriptionDefaultsFromMedicine(med)).toEqual({
      medication_id: MED_ACTIVE_ID,
      medication_name: "Amoxil (Amoxicillin) 500mg",
      dosage: "1 capsule",
      frequency: "3x daily",
      duration: "7 days",
      route: "Oral",
      quantity: 21,
      instructions: "Take after meals",
    });
  });

  it("loads active clinic medicines immediately on empty query and sets canQuickAdd by role", async () => {
    prismaMock.medications.findMany.mockResolvedValue([
      {
        id: MED_ACTIVE_ID,
        generic_name: "Amoxicillin",
        brand_name: "Amoxil",
        category: "antibiotic",
        strength: "500mg",
        form: "Capsule",
        route: "Oral",
        default_dosage: "1 capsule",
        default_frequency: "3x daily",
        default_duration: "7 days",
        default_quantity: 21,
        default_instructions: "After food",
      },
    ]);

    const doctorCatalog = await getPrescriptionCatalog("");
    expect(doctorCatalog.canQuickAdd).toBe(true);
    expect(doctorCatalog.medicines).toHaveLength(1);
    expect(prismaMock.medications.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clinic_id: CLINIC_ID, is_active: true },
      }),
    );

    mockTenant.mockResolvedValue(makeTenant("admin"));
    const adminCatalog = await getPrescriptionCatalog("");
    expect(adminCatalog.canQuickAdd).toBe(false);
  });

  it("rejects creating a prescription with free-text (no medication_id)", async () => {
    const res = await createPrescription({
      patient_id: PATIENT_ID,
      status: "active",
      items: [
        {
          medication_id: null,
          medication_name: "Custom Drug",
          dosage: "500mg",
        },
      ],
    });

    expect(res).toEqual({
      error: "Please select a medicine from the catalog",
    });
    expect(prismaMock.prescriptions.create).not.toHaveBeenCalled();
  });

  it("rejects creating a prescription with a stopped or foreign medicine", async () => {
    prismaMock.medications.findMany.mockResolvedValue([]);

    const res = await createPrescription({
      patient_id: PATIENT_ID,
      status: "active",
      items: [
        {
          medication_id: MED_STOPPED_ID,
          medication_name: "Stopped Drug",
          dosage: "1 tab",
        },
      ],
    });

    expect(res).toEqual({
      error: "One or more selected medicines are unavailable or stopped",
    });
    expect(prismaMock.prescriptions.create).not.toHaveBeenCalled();
  });

  it("creates a prescription using active catalog medicine and canonicalizes name", async () => {
    prismaMock.medications.findMany.mockResolvedValue([
      {
        id: MED_ACTIVE_ID,
        generic_name: "Amoxicillin",
        brand_name: "Amoxil",
        strength: "500mg",
      },
    ]);
    prismaMock.patients.findFirst.mockResolvedValue({ id: PATIENT_ID });
    prismaMock.prescriptions.create.mockResolvedValue({ id: RX_ID });

    const res = await createPrescription({
      patient_id: PATIENT_ID,
      status: "active",
      items: [
        {
          medication_id: MED_ACTIVE_ID,
          medication_name: "Old label",
          dosage: "1 capsule",
          frequency: "3x daily",
          duration: "7 days",
          route: "Oral",
          quantity: 21,
          instructions: "After meals",
        },
      ],
    });

    expect(res).toEqual({ success: true, data: { id: RX_ID } });
    expect(prismaMock.prescriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prescription_items: {
            create: [
              expect.objectContaining({
                medication_id: MED_ACTIVE_ID,
                medication_name: "Amoxil (Amoxicillin) 500mg",
              }),
            ],
          },
        }),
      }),
    );
  });

  it("preserves unchanged legacy or stopped items on edit while rejecting newly added stopped medicines", async () => {
    prismaMock.prescriptions.findFirst.mockResolvedValue({
      id: RX_ID,
      prescription_items: [
        { medication_id: null, medication_name: "Legacy Syrup" },
        { medication_id: MED_STOPPED_ID, medication_name: "Old Med" },
      ],
    });

    const preserveRes = await updatePrescription(RX_ID, {
      patient_id: PATIENT_ID,
      status: "active",
      items: [
        {
          medication_id: null,
          medication_name: "Legacy Syrup",
          is_legacy: true,
        },
        {
          medication_id: MED_STOPPED_ID,
          medication_name: "Old Med",
        },
      ],
    });

    expect(preserveRes).toEqual({ success: true, data: { id: RX_ID } });
    expect(prismaMock.medications.findMany).not.toHaveBeenCalled();

    // Now try adding a stopped/unavailable medicine not previously on the Rx.
    const NEW_STOPPED_ID = "77777777-7777-4777-8777-777777777777";
    prismaMock.medications.findMany.mockResolvedValue([]);

    const rejectNewStopped = await updatePrescription(RX_ID, {
      patient_id: PATIENT_ID,
      status: "active",
      items: [
        {
          medication_id: NEW_STOPPED_ID,
          medication_name: "Newly Added Stopped Med",
        },
      ],
    });

    expect(rejectNewStopped).toEqual({
      error: "One or more selected medicines are unavailable or stopped",
    });
  });
});
