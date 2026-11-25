import { describe, expect, it } from "vitest";
import {
  buildDayTimeSlots,
  computeBookingCapabilities,
  hasDoctorSlotConflict,
  isDoctorWorkingOnDay,
  normalizeDoctorAvailability,
  resolveBookingRoleScope,
  validateDoctorSlotAvailability,
} from "@/lib/booking-rules";

describe("resolveBookingRoleScope", () => {
  it("maps all clinic roles into deterministic booking scopes", () => {
    expect(resolveBookingRoleScope("admin")).toBe("admin");
    expect(resolveBookingRoleScope("owner")).toBe("admin");
    expect(resolveBookingRoleScope("super_admin")).toBe("admin");
    expect(resolveBookingRoleScope("doctor")).toBe("doctor");
    expect(resolveBookingRoleScope("patient")).toBe("patient");
    expect(resolveBookingRoleScope("staff")).toBe("staff");
    expect(resolveBookingRoleScope("receptionist")).toBe("staff");
  });
});

describe("computeBookingCapabilities", () => {
  const now = new Date("2026-12-01T10:00:00.000Z");
  const futureDate = new Date("2026-12-02T10:00:00.000Z");
  const pastDate = new Date("2026-11-30T10:00:00.000Z");

  it("allows patient to edit, reschedule, switch doctor/branch, and cancel future scheduled bookings", () => {
    const caps = computeBookingCapabilities({
      roleScope: "patient",
      status: "scheduled",
      appointmentDate: futureDate,
      canCreatePermission: true,
      canCancelPermission: true,
      branchLocked: false,
      now,
    });

    expect(caps.canEditDetails).toBe(true);
    expect(caps.canReschedule).toBe(true);
    expect(caps.canChangeDoctor).toBe(true);
    expect(caps.canChangeBranch).toBe(true);
    expect(caps.canCancel).toBe(true);
    expect(caps.canCheckIn).toBe(false);
    expect(caps.canComplete).toBe(false);
    expect(caps.lockReason).toBeNull();
  });

  it("locks patient bookings once checked_in or in the past or terminal", () => {
    const checkedInCaps = computeBookingCapabilities({
      roleScope: "patient",
      status: "checked_in",
      appointmentDate: futureDate,
      canCreatePermission: true,
      canCancelPermission: true,
      branchLocked: false,
      now,
    });
    expect(checkedInCaps.canEditDetails).toBe(false);
    expect(checkedInCaps.canCancel).toBe(false);
    expect(checkedInCaps.lockReason).toBe("checked_in");

    const pastCaps = computeBookingCapabilities({
      roleScope: "patient",
      status: "scheduled",
      appointmentDate: pastDate,
      canCreatePermission: true,
      canCancelPermission: true,
      branchLocked: false,
      now,
    });
    expect(pastCaps.canEditDetails).toBe(false);
    expect(pastCaps.lockReason).toBe("past");

    const completedCaps = computeBookingCapabilities({
      roleScope: "patient",
      status: "completed",
      appointmentDate: futureDate,
      canCreatePermission: true,
      canCancelPermission: true,
      branchLocked: false,
      now,
    });
    expect(completedCaps.canEditDetails).toBe(false);
    expect(completedCaps.lockReason).toBe("completed");
  });

  it("respects staff RBAC permissions and branch lock", () => {
    const caps = computeBookingCapabilities({
      roleScope: "staff",
      status: "scheduled",
      appointmentDate: futureDate,
      canCreatePermission: true,
      canCancelPermission: false,
      branchLocked: true,
      now,
    });

    expect(caps.canEditDetails).toBe(true);
    expect(caps.canChangeBranch).toBe(false);
    expect(caps.canCheckIn).toBe(true);
    expect(caps.canCancel).toBe(false);

    const lockedTerminal = computeBookingCapabilities({
      roleScope: "staff",
      status: "cancelled",
      appointmentDate: futureDate,
      canCreatePermission: true,
      canCancelPermission: true,
      branchLocked: true,
      now,
    });
    expect(lockedTerminal.canEditDetails).toBe(false);
    expect(lockedTerminal.lockReason).toBe("cancelled");
  });

  it("prevents doctor from reassigning doctor while allowing edits and status transitions", () => {
    const caps = computeBookingCapabilities({
      roleScope: "doctor",
      status: "checked_in",
      appointmentDate: futureDate,
      canCreatePermission: true,
      canCancelPermission: true,
      branchLocked: false,
      now,
    });

    expect(caps.canEditDetails).toBe(true);
    expect(caps.canChangeDoctor).toBe(false);
    expect(caps.canComplete).toBe(true);
    expect(caps.canCheckIn).toBe(false);
  });

  it("allows admin override on terminal statuses", () => {
    const caps = computeBookingCapabilities({
      roleScope: "admin",
      status: "completed",
      appointmentDate: pastDate,
      canCreatePermission: true,
      canCancelPermission: true,
      branchLocked: false,
      now,
    });

    expect(caps.canEditDetails).toBe(true);
    expect(caps.canOverrideTerminal).toBe(true);
    expect(caps.canCheckIn).toBe(true);
    expect(caps.canCancel).toBe(true);
    expect(caps.lockReason).toBeNull();
  });
});

describe("hasDoctorSlotConflict", () => {
  const existing = [new Date("2026-12-01T09:00:00.000Z")];

  it("detects exact, 15-min, and 29-min overlaps as conflicts", () => {
    expect(
      hasDoctorSlotConflict(existing, new Date("2026-12-01T09:00:00.000Z")),
    ).toBe(true);
    expect(
      hasDoctorSlotConflict(existing, new Date("2026-12-01T09:15:00.000Z")),
    ).toBe(true);
    expect(
      hasDoctorSlotConflict(existing, new Date("2026-12-01T08:31:00.000Z")),
    ).toBe(true);
  });

  it("allows exact 30-min adjacent boundaries and further times", () => {
    expect(
      hasDoctorSlotConflict(existing, new Date("2026-12-01T09:30:00.000Z")),
    ).toBe(false);
    expect(
      hasDoctorSlotConflict(existing, new Date("2026-12-01T08:30:00.000Z")),
    ).toBe(false);
  });
});

describe("buildDayTimeSlots", () => {
  it("builds 24 half-hour slots from 08:00 to 19:30 with occupied and past flags", () => {
    const day = new Date(2026, 11, 2, 0, 0, 0, 0);
    const occupied = [new Date(2026, 11, 2, 10, 0, 0, 0)];
    const now = new Date(2026, 11, 2, 9, 15, 0, 0);

    const slots = buildDayTimeSlots(day, occupied, now);
    expect(slots).toHaveLength(24);
    expect(slots[0].time).toBe("08:00");
    expect(slots[23].time).toBe("19:30");

    const slot0900 = slots.find((s) => s.time === "09:00");
    const slot1000 = slots.find((s) => s.time === "10:00");
    const slot1030 = slots.find((s) => s.time === "10:30");

    expect(slot0900?.isPast).toBe(true);
    expect(slot1000?.isOccupied).toBe(true);
    expect(slot1000?.isPast).toBe(false);
    expect(slot1030?.isOccupied).toBe(false);
  });

  it("generates 15-minute slots strictly inside doctor availability and returns empty on inactive or off-days", () => {
    const availability = normalizeDoctorAvailability({
      status: "active",
      available_from: "10:00",
      available_to: "12:00",
      slot_duration_minutes: 15,
      available_days: [1, 3], // Mon, Wed
    });

    const monday = new Date(2026, 11, 7, 0, 0, 0, 0); // Monday
    const tuesday = new Date(2026, 11, 8, 0, 0, 0, 0); // Tuesday
    const occupied = [new Date(2026, 11, 7, 10, 30, 0, 0)];

    expect(isDoctorWorkingOnDay(availability, monday)).toBe(true);
    expect(isDoctorWorkingOnDay(availability, tuesday)).toBe(false);

    const monSlots = buildDayTimeSlots(monday, occupied, {
      now: new Date(2026, 11, 7, 9, 0, 0, 0),
      availability,
    });
    expect(monSlots).toHaveLength(8); // 10:00..11:45
    expect(monSlots[0].time).toBe("10:00");
    expect(monSlots[7].time).toBe("11:45");
    expect(monSlots.find((s) => s.time === "10:30")?.isOccupied).toBe(true);
    expect(monSlots.find((s) => s.time === "10:45")?.isOccupied).toBe(false);

    expect(buildDayTimeSlots(tuesday, [], { availability })).toEqual([]);

    const inactive = { ...availability, isActive: false };
    expect(buildDayTimeSlots(monday, [], { availability: inactive })).toEqual(
      [],
    );
  });
});

describe("validateDoctorSlotAvailability", () => {
  const availability = normalizeDoctorAvailability({
    status: "active",
    available_from: "09:00",
    available_to: "17:00",
    slot_duration_minutes: 30,
    available_days: [0, 1, 2, 3, 4],
  });

  it("rejects inactive doctors, off days, and times outside working hours", () => {
    const monday10am = new Date(2026, 11, 7, 10, 0, 0, 0);
    const friday10am = new Date(2026, 11, 11, 10, 0, 0, 0);
    const monday0830 = new Date(2026, 11, 7, 8, 30, 0, 0);
    const monday1645 = new Date(2026, 11, 7, 16, 45, 0, 0); // ends at 17:15 > 17:00
    const monday1630 = new Date(2026, 11, 7, 16, 30, 0, 0); // ends at 17:00 (valid)

    expect(
      validateDoctorSlotAvailability(
        { ...availability, isActive: false },
        monday10am,
      ),
    ).toMatchObject({ valid: false, reason: "inactive" });

    expect(
      validateDoctorSlotAvailability(availability, friday10am),
    ).toMatchObject({ valid: false, reason: "day_off" });

    expect(
      validateDoctorSlotAvailability(availability, monday0830),
    ).toMatchObject({ valid: false, reason: "outside_hours" });

    expect(
      validateDoctorSlotAvailability(availability, monday1645),
    ).toMatchObject({ valid: false, reason: "outside_hours" });

    expect(validateDoctorSlotAvailability(availability, monday1630)).toEqual({
      valid: true,
    });
  });
});
