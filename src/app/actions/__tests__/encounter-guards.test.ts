import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  patients: {
    findUnique: vi.fn(),
  },
  encounters: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  prescriptions: {
    findMany: vi.fn(),
  },
  lab_orders: {
    findMany: vi.fn(),
  },
  appointments: {
    findFirst: vi.fn(),
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
import { createEncounter, getPatientDetails } from "@/app/actions/doctor";

const mockTenant = vi.mocked(requireTenantInfo);
const mockRevalidatePath = vi.mocked(revalidatePath);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const DOCTOR_ID = "44444444-4444-4444-8444-444444444444";
const APPT_ID = "55555555-5555-4555-8555-555555555555";
const ENCOUNTER_ID = "66666666-6666-4666-8666-666666666666";

function makeTenant(role = "doctor") {
  return {
    userId: `user-${DOCTOR_ID}`,
    orgId: null,
    profileId: DOCTOR_ID,
    role,
    fullName: "Dr. Ahmed Hassan",
    email: "doctor@clinic.test",
    is_profile_completed: true,
    is_owner: role === "owner",
    clinicId: CLINIC_ID,
    clinicName: "Bluewave Clinic",
    subscriptionPlan: "pro",
    branchId: BRANCH_ID,
    branchName: "Main Branch",
    branchLocked: role === "doctor",
    profileStatus: "active",
    clinicStatus: "active" as const,
    access: { allowed: true as const, warning: null },
    auth_user_id: `user-${DOCTOR_ID}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTenant.mockResolvedValue(makeTenant("doctor"));
  prismaMock.patients.findUnique.mockResolvedValue({
    id: PATIENT_ID,
    first_name: "Ali",
    last_name: "Noor",
    gender: "male",
    date_of_birth: null,
    phone: null,
    email: null,
    address: null,
  });
  prismaMock.encounters.findMany.mockResolvedValue([]);
  prismaMock.prescriptions.findMany.mockResolvedValue([]);
  prismaMock.lab_orders.findMany.mockResolvedValue([]);
});

describe("getPatientDetails read-only mode", () => {
  it("returns isReadOnly: true and currentAppointment: null when appointmentId is omitted", async () => {
    const res = await getPatientDetails(PATIENT_ID);

    expect(res.isReadOnly).toBe(true);
    expect(res.currentAppointment).toBeNull();
    expect(res.canConfirmAllPatientLabs).toBe(false);
    expect(prismaMock.appointments.findFirst).not.toHaveBeenCalled();
  });

  it("queries excluding completed, cancelled, and no_show appointments and returns isReadOnly: true when none matches", async () => {
    prismaMock.appointments.findFirst.mockResolvedValue(null);

    const res = await getPatientDetails(PATIENT_ID, APPT_ID);

    expect(prismaMock.appointments.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: APPT_ID,
          clinic_id: CLINIC_ID,
          patient_id: PATIENT_ID,
          doctor_id: DOCTOR_ID,
          status: { notIn: ["completed", "cancelled", "no_show"] },
        },
      }),
    );
    expect(res.isReadOnly).toBe(true);
    expect(res.currentAppointment).toBeNull();
    expect(res.canConfirmAllPatientLabs).toBe(false);
  });

  it("returns isReadOnly: false and currentAppointment when an active appointment matches", async () => {
    prismaMock.appointments.findFirst.mockResolvedValue({
      id: APPT_ID,
      appointment_date: new Date("2026-11-28T10:00:00Z"),
      status: "scheduled",
      notes: "Follow-up",
      billing_catalog_items: null,
    });

    const res = await getPatientDetails(PATIENT_ID, APPT_ID);

    expect(res.isReadOnly).toBe(false);
    expect(res.canConfirmAllPatientLabs).toBe(true);
    expect(res.currentAppointment).toMatchObject({
      id: APPT_ID,
      status: "scheduled",
      notes: "Follow-up",
    });
  });
});

describe("createEncounter active-appointment guard", () => {
  it("rejects calls without appointment_id", async () => {
    await expect(
      createEncounter(PATIENT_ID, {
        diagnosis: "Acute Pharyngitis",
        notes: "Sore throat and fever for 2 days.",
      }),
    ).rejects.toThrow("An active appointment is required");
    expect(prismaMock.encounters.create).not.toHaveBeenCalled();
  });

  it("rejects calls when the appointment does not belong to the doctor/patient/clinic", async () => {
    prismaMock.appointments.findFirst.mockResolvedValue(null);

    await expect(
      createEncounter(PATIENT_ID, {
        appointment_id: APPT_ID,
        diagnosis: "Acute Pharyngitis",
        notes: "Sore throat and fever for 2 days.",
      }),
    ).rejects.toThrow("Active appointment not found");
    expect(prismaMock.encounters.create).not.toHaveBeenCalled();
  });

  it.each(["completed", "cancelled", "no_show"])(
    "rejects calls for a %s appointment",
    async (status) => {
      prismaMock.appointments.findFirst.mockResolvedValue({
        id: APPT_ID,
        status,
        branch_id: BRANCH_ID,
      });

      await expect(
        createEncounter(PATIENT_ID, {
          appointment_id: APPT_ID,
          diagnosis: "Acute Pharyngitis",
          notes: "Sore throat and fever for 2 days.",
        }),
      ).rejects.toThrow("closed or completed appointment");
      expect(prismaMock.encounters.create).not.toHaveBeenCalled();
    },
  );

  it("creates the encounter, marks the appointment completed, and revalidates paths for an active appointment", async () => {
    prismaMock.appointments.findFirst.mockResolvedValue({
      id: APPT_ID,
      status: "scheduled",
      branch_id: BRANCH_ID,
    });
    prismaMock.encounters.create.mockResolvedValue({
      id: ENCOUNTER_ID,
      patient_id: PATIENT_ID,
      appointment_id: APPT_ID,
    });
    prismaMock.appointments.update.mockResolvedValue({
      id: APPT_ID,
      status: "completed",
    });

    const encounter = await createEncounter(PATIENT_ID, {
      appointment_id: APPT_ID,
      diagnosis: "Acute Pharyngitis",
      notes: "Sore throat and fever for 2 days.",
    });

    expect(encounter).toMatchObject({ id: ENCOUNTER_ID });
    expect(prismaMock.encounters.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinic_id: CLINIC_ID,
        branch_id: BRANCH_ID,
        patient_id: PATIENT_ID,
        doctor_id: DOCTOR_ID,
        appointment_id: APPT_ID,
        diagnosis: "Acute Pharyngitis",
        notes: "Sore throat and fever for 2 days.",
      }),
    });
    expect(prismaMock.appointments.update).toHaveBeenCalledWith({
      where: { id: APPT_ID },
      data: { status: "completed" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/doctor/patients/${PATIENT_ID}`,
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/doctor/appointments");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/doctor");
  });
});
