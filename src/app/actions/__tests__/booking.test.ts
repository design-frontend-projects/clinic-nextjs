import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  appointments: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  patients: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  profiles: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  clinic_branches: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ requireTenantInfo: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: vi.fn() }));
vi.mock("@/lib/patient-auth", () => ({ requireCurrentPatient: vi.fn() }));
vi.mock("@/lib/appointment-service", () => ({
  registerPatientWithAppointmentForScope: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireTenantInfo } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { requireCurrentPatient } from "@/lib/patient-auth";
import { revalidatePath } from "next/cache";
import {
  cancelBooking,
  createBooking,
  getBookingById,
  getBookings,
  updateBooking,
} from "@/app/actions/booking";

const mockRequireTenant = vi.mocked(requireTenantInfo);
const mockHasPermission = vi.mocked(hasPermission);
const mockRequirePatient = vi.mocked(requireCurrentPatient);
const mockRevalidatePath = vi.mocked(revalidatePath);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const DOCTOR_ID = "44444444-4444-4444-8444-444444444444";
const BOOKING_ID = "55555555-5555-4555-8555-555555555555";

const FUTURE_DATE = new Date("2028-06-15T10:00:00.000Z");
const PAST_DATE = new Date("2020-01-10T10:00:00.000Z");

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  } as Awaited<ReturnType<typeof requireTenantInfo>>;
}

function makeAppointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    clinic_id: CLINIC_ID,
    branch_id: BRANCH_ID,
    patient_id: PATIENT_ID,
    doctor_id: DOCTOR_ID,
    appointment_date: FUTURE_DATE,
    status: "scheduled",
    notes: "Follow-up",
    checked_in_at: null,
    created_at: new Date("2026-11-20T08:00:00.000Z"),
    updated_at: new Date("2026-11-20T08:00:00.000Z"),
    patients: {
      id: PATIENT_ID,
      first_name: "Sara",
      last_name: "Ali",
      phone: "01001234567",
      email: "sara@example.com",
    },
    profiles: {
      id: DOCTOR_ID,
      full_name: "Dr. Ahmed",
      specialty: "Cardiology",
      email: "ahmed@clinic.test",
    },
    branches: {
      id: BRANCH_ID,
      name: "Main Branch",
    },
    review: null,
    _count: {
      encounters: 0,
      lab_orders: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHasPermission.mockResolvedValue(true);
  mockRequireTenant.mockResolvedValue(makeTenant({ role: "staff" }));
  mockRequirePatient.mockResolvedValue({
    tenant: makeTenant({ role: "patient", branchId: null, branchLocked: false }),
    patient: { id: PATIENT_ID } as never,
  });
});

describe("booking server actions", () => {
  it("scopes getBookings to the logged-in patient record", async () => {
    mockRequireTenant.mockResolvedValue(
      makeTenant({ role: "patient", branchId: null, branchLocked: false }),
    );
    prismaMock.appointments.findMany.mockResolvedValue([makeAppointmentRow()]);
    prismaMock.appointments.count.mockResolvedValue(1);
    prismaMock.appointments.groupBy.mockResolvedValue([
      { status: "scheduled", _count: { _all: 1 } },
    ]);

    const result = await getBookings();

    expect(result.items).toHaveLength(1);
    expect(prismaMock.appointments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clinic_id: CLINIC_ID,
          patient_id: PATIENT_ID,
        }),
      }),
    );
  });

  it("returns null from getBookingById for invalid UUIDs without hitting Prisma", async () => {
    const result = await getBookingById("not-a-uuid");
    expect(result).toBeNull();
    expect(prismaMock.appointments.findFirst).not.toHaveBeenCalled();
  });

  it("rejects patient self-booking in the past", async () => {
    mockRequireTenant.mockResolvedValue(
      makeTenant({ role: "patient", branchId: null, branchLocked: false }),
    );

    const res = await createBooking({
      doctor_id: DOCTOR_ID,
      appointment_date: PAST_DATE.toISOString(),
    });

    expect(res).toEqual({ error: "Cannot book an appointment in the past." });
    expect(prismaMock.appointments.create).not.toHaveBeenCalled();
  });

  it("rejects createBooking when doctor has a 30-min conflict", async () => {
    mockRequireTenant.mockResolvedValue(
      makeTenant({ role: "patient", branchId: null, branchLocked: false }),
    );
    prismaMock.profiles.findFirst.mockResolvedValue({ id: DOCTOR_ID });
    prismaMock.appointments.findFirst.mockResolvedValue({ id: "existing-appt" });

    const res = await createBooking({
      doctor_id: DOCTOR_ID,
      appointment_date: FUTURE_DATE.toISOString(),
    });

    expect(res).toEqual({
      error:
        "This doctor already has an appointment within 30 minutes of the selected time. Please choose another slot.",
    });
    expect(prismaMock.appointments.create).not.toHaveBeenCalled();
  });

  it("creates a patient booking and revalidates paths when slot is free", async () => {
    mockRequireTenant.mockResolvedValue(
      makeTenant({ role: "patient", branchId: null, branchLocked: false }),
    );
    prismaMock.profiles.findFirst.mockResolvedValue({ id: DOCTOR_ID });
    prismaMock.appointments.findFirst.mockResolvedValue(null);
    prismaMock.appointments.create.mockResolvedValue(makeAppointmentRow());

    const res = await createBooking({
      doctor_id: DOCTOR_ID,
      appointment_date: FUTURE_DATE.toISOString(),
      notes: "Annual checkup",
    });

    expect("success" in res && res.success).toBe(true);
    expect(prismaMock.appointments.create).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/booking");
  });

  it("blocks staff without appointment.create from creating bookings", async () => {
    mockHasPermission.mockImplementation(async (perm) => perm === "appointment.read");

    const res = await createBooking({
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_ID,
      appointment_date: FUTURE_DATE.toISOString(),
    });

    expect(res).toEqual({
      error: "You do not have permission to create bookings.",
    });
  });

  it("allows patient to reschedule own future scheduled booking", async () => {
    mockRequireTenant.mockResolvedValue(
      makeTenant({ role: "patient", branchId: null, branchLocked: false }),
    );
    const nextSlot = new Date("2028-06-16T11:00:00.000Z");
    prismaMock.appointments.findFirst
      .mockResolvedValueOnce(makeAppointmentRow()) // existing fetch
      .mockResolvedValueOnce(null); // conflict check
    prismaMock.appointments.update.mockResolvedValue(
      makeAppointmentRow({ appointment_date: nextSlot }),
    );

    const res = await updateBooking({
      id: BOOKING_ID,
      appointment_date: nextSlot.toISOString(),
      notes: "Moved to next day",
    });

    expect("success" in res && res.success).toBe(true);
    expect(prismaMock.appointments.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID },
        data: expect.objectContaining({
          appointment_date: nextSlot,
          notes: "Moved to next day",
        }),
      }),
    );
  });

  it("blocks patient from modifying a checked_in or completed booking", async () => {
    mockRequireTenant.mockResolvedValue(
      makeTenant({ role: "patient", branchId: null, branchLocked: false }),
    );
    prismaMock.appointments.findFirst.mockResolvedValue(
      makeAppointmentRow({ status: "checked_in" }),
    );

    const res = await updateBooking({
      id: BOOKING_ID,
      notes: "Cannot edit",
    });

    expect(res).toEqual({ error: "This booking can no longer be modified." });
    expect(prismaMock.appointments.update).not.toHaveBeenCalled();
  });

  it("allows admin to override a completed booking status", async () => {
    mockRequireTenant.mockResolvedValue(
      makeTenant({ role: "admin", branchId: null, branchLocked: false }),
    );
    prismaMock.appointments.findFirst
      .mockResolvedValueOnce(makeAppointmentRow({ status: "completed" }))
      .mockResolvedValueOnce(null);
    prismaMock.appointments.update.mockResolvedValue(
      makeAppointmentRow({ status: "scheduled" }),
    );

    const res = await updateBooking({
      id: BOOKING_ID,
      status: "scheduled",
    });

    expect("success" in res && res.success).toBe(true);
  });

  it("requires appointment.cancel for staff to cancel a booking", async () => {
    mockHasPermission.mockImplementation(
      async (perm) => perm !== "appointment.cancel",
    );
    prismaMock.appointments.findFirst.mockResolvedValue(makeAppointmentRow());

    const res = await cancelBooking(BOOKING_ID);

    expect(res).toEqual({ error: "You cannot cancel this booking." });
    expect(prismaMock.appointments.update).not.toHaveBeenCalled();
  });

  it("stamps checked_in_at when transitioning into checked_in", async () => {
    prismaMock.appointments.findFirst.mockResolvedValue(makeAppointmentRow());
    prismaMock.appointments.update.mockResolvedValue(
      makeAppointmentRow({
        status: "checked_in",
        checked_in_at: new Date(),
      }),
    );

    const res = await updateBooking({
      id: BOOKING_ID,
      status: "checked_in",
    });

    expect("success" in res && res.success).toBe(true);
    expect(prismaMock.appointments.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "checked_in",
          checked_in_at: expect.any(Date),
        }),
      }),
    );
  });
});
