import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  lab_orders: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  appointments: {
    findFirst: vi.fn(),
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
import { confirmLabOrder } from "@/app/actions/doctor";

const mockTenant = vi.mocked(requireTenantInfo);
const mockRevalidatePath = vi.mocked(revalidatePath);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const DOCTOR_1 = "44444444-4444-4444-8444-444444444444";
const DOCTOR_2 = "55555555-5555-4555-8555-555555555555";
const LAB_ORDER_ID = "66666666-6666-4666-8666-666666666666";
const APPT_OLD_ID = "77777777-7777-4777-8777-777777777777";
const APPT_CURRENT_ID = "88888888-8888-4888-8888-888888888888";

function makeTenant(profileId: string, role: string) {
  return {
    userId: `user-${profileId}`,
    orgId: null,
    profileId,
    role,
    fullName: `Dr. ${profileId.slice(0, 4)}`,
    email: "doctor@clinic.test",
    is_profile_completed: true,
    is_owner: role === "owner",
    clinicId: CLINIC_ID,
    clinicName: "Test Clinic",
    subscriptionPlan: "pro",
    branchId: BRANCH_ID,
    branchName: "Main Branch",
    branchLocked: role === "doctor",
    profileStatus: "active",
    clinicStatus: "active" as const,
    access: { allowed: true as const, warning: null },
    auth_user_id: `user-${profileId}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTenant.mockResolvedValue(makeTenant(DOCTOR_1, "doctor"));
});

describe("confirmLabOrder", () => {
  it("allows the ordering doctor to confirm an ordered lab request with notes", async () => {
    prismaMock.lab_orders.findFirst.mockResolvedValue({
      id: LAB_ORDER_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_1,
      status: "ordered",
      appointments: { id: APPT_OLD_ID, doctor_id: DOCTOR_1 },
    });
    prismaMock.lab_orders.update.mockResolvedValue({
      id: LAB_ORDER_ID,
      status: "confirmed",
      confirmed_by: DOCTOR_1,
      doctor_notes: "CBC within normal range",
    });

    const res = await confirmLabOrder({
      lab_order_id: LAB_ORDER_ID,
      doctor_notes: "CBC within normal range",
    });

    expect(res).toMatchObject({
      success: true,
      labOrder: { id: LAB_ORDER_ID, status: "confirmed" },
    });
    expect(prismaMock.lab_orders.update).toHaveBeenCalledWith({
      where: { id: LAB_ORDER_ID },
      data: expect.objectContaining({
        status: "confirmed",
        confirmed_by: DOCTOR_1,
        doctor_notes: "CBC within normal range",
        confirmed_at: expect.any(Date),
      }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/doctor/lab-orders");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/doctor/appointments");
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/doctor/patients/${PATIENT_ID}`,
    );
  });

  it("allows a different doctor currently examining the same patient to confirm an unconfirmed lab request", async () => {
    mockTenant.mockResolvedValue(makeTenant(DOCTOR_2, "doctor"));
    prismaMock.lab_orders.findFirst.mockResolvedValue({
      id: LAB_ORDER_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_1,
      status: "ordered",
      appointments: { id: APPT_OLD_ID, doctor_id: DOCTOR_1 },
    });
    prismaMock.appointments.findFirst.mockResolvedValue({
      id: APPT_CURRENT_ID,
    });
    prismaMock.lab_orders.update.mockResolvedValue({
      id: LAB_ORDER_ID,
      status: "confirmed",
      confirmed_by: DOCTOR_2,
      doctor_notes: "Reviewed in follow-up visit",
    });

    const res = await confirmLabOrder({
      lab_order_id: LAB_ORDER_ID,
      doctor_notes: "Reviewed in follow-up visit",
      current_appointment_id: APPT_CURRENT_ID,
    });

    expect(prismaMock.appointments.findFirst).toHaveBeenCalledWith({
      where: {
        id: APPT_CURRENT_ID,
        clinic_id: CLINIC_ID,
        patient_id: PATIENT_ID,
        doctor_id: DOCTOR_2,
        status: { notIn: ["cancelled", "no_show"] },
      },
      select: { id: true },
    });
    expect(res).toMatchObject({ success: true });
    expect(prismaMock.lab_orders.update).toHaveBeenCalledWith({
      where: { id: LAB_ORDER_ID },
      data: expect.objectContaining({
        status: "confirmed",
        confirmed_by: DOCTOR_2,
        doctor_notes: "Reviewed in follow-up visit",
      }),
    });
  });

  it("rejects another doctor without a valid examination appointment for that patient", async () => {
    mockTenant.mockResolvedValue(makeTenant(DOCTOR_2, "doctor"));
    prismaMock.lab_orders.findFirst.mockResolvedValue({
      id: LAB_ORDER_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_1,
      status: "ordered",
      appointments: { id: APPT_OLD_ID, doctor_id: DOCTOR_1 },
    });
    prismaMock.appointments.findFirst.mockResolvedValue(null);

    const res = await confirmLabOrder({
      lab_order_id: LAB_ORDER_ID,
      doctor_notes: "Attempted cross-doctor confirm",
      current_appointment_id: APPT_CURRENT_ID,
    });

    expect(res).toEqual({
      error:
        "Unauthorized: only the assigned or currently examining doctor can confirm this lab order",
    });
    expect(prismaMock.lab_orders.update).not.toHaveBeenCalled();
  });

  it("rejects confirming a cancelled lab order", async () => {
    prismaMock.lab_orders.findFirst.mockResolvedValue({
      id: LAB_ORDER_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_1,
      status: "cancelled",
      appointments: null,
    });

    const res = await confirmLabOrder({
      lab_order_id: LAB_ORDER_ID,
    });

    expect(res).toEqual({ error: "Cannot confirm a cancelled lab order" });
    expect(prismaMock.lab_orders.update).not.toHaveBeenCalled();
  });

  it("allows only the confirming doctor to update notes on an already confirmed lab order without changing status", async () => {
    prismaMock.lab_orders.findFirst.mockResolvedValue({
      id: LAB_ORDER_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_1,
      status: "confirmed",
      confirmed_by: DOCTOR_1,
      appointments: null,
    });
    prismaMock.lab_orders.update.mockResolvedValue({
      id: LAB_ORDER_ID,
      status: "confirmed",
      confirmed_by: DOCTOR_1,
      doctor_notes: "Updated clinical note",
    });

    const ok = await confirmLabOrder({
      lab_order_id: LAB_ORDER_ID,
      doctor_notes: "Updated clinical note",
    });
    expect(ok).toMatchObject({ success: true });
    expect(prismaMock.lab_orders.update).toHaveBeenCalledWith({
      where: { id: LAB_ORDER_ID },
      data: { doctor_notes: "Updated clinical note" },
    });

    vi.clearAllMocks();
    mockTenant.mockResolvedValue(makeTenant(DOCTOR_2, "doctor"));
    prismaMock.lab_orders.findFirst.mockResolvedValue({
      id: LAB_ORDER_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_1,
      status: "confirmed",
      confirmed_by: DOCTOR_1,
      appointments: null,
    });

    const denied = await confirmLabOrder({
      lab_order_id: LAB_ORDER_ID,
      doctor_notes: "Trying to overwrite",
      current_appointment_id: APPT_CURRENT_ID,
    });
    expect(denied).toEqual({
      error:
        "Only the confirming doctor can update notes on a confirmed lab order",
    });
    expect(prismaMock.lab_orders.update).not.toHaveBeenCalled();
  });

  it("rejects non-practitioner roles", async () => {
    mockTenant.mockResolvedValue(makeTenant(DOCTOR_1, "staff"));

    const res = await confirmLabOrder({
      lab_order_id: LAB_ORDER_ID,
    });

    expect(res).toEqual({ error: "Unauthorized" });
    expect(prismaMock.lab_orders.findFirst).not.toHaveBeenCalled();
  });
});
