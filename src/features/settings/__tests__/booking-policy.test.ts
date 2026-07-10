// src/features/settings/__tests__/booking-policy.test.ts
import { describe, it, expect } from "vitest";
import { validateBookingTime, validateCancellation } from "../domain/booking-policy";
import type { AppointmentSettings, WeeklySchedule } from "../domain/models";

// 2026-07-10 is a Friday.
const NOW = new Date("2026-07-10T08:00:00");

const openDay = { enabled: true, start: "09:00", end: "17:00" };
const WORKING_HOURS: WeeklySchedule = {
  monday: openDay,
  tuesday: openDay,
  wednesday: openDay,
  thursday: openDay,
  friday: openDay,
  saturday: openDay,
  sunday: { enabled: false, start: "09:00", end: "17:00" },
};

const SETTINGS: AppointmentSettings = {
  slotDurationMinutes: 30,
  minLeadTimeHours: 1,
  maxAdvanceDays: 90,
  cancellationWindowHours: 24,
  allowOnlineBooking: true,
  reminderRules: [],
};

describe("validateBookingTime", () => {
  it("accepts an aligned slot inside working hours", () => {
    expect(validateBookingTime(new Date("2026-07-10T10:30:00"), WORKING_HOURS, SETTINGS, NOW)).toBeNull();
  });

  it("rejects a booking below the minimum lead time", () => {
    const error = validateBookingTime(new Date("2026-07-10T08:30:00"), WORKING_HOURS, SETTINGS, NOW);
    expect(error).toContain("at least 1 hour");
  });

  it("rejects a booking beyond the max advance window", () => {
    const error = validateBookingTime(new Date("2026-11-10T10:00:00"), WORKING_HOURS, SETTINGS, NOW);
    expect(error).toContain("more than 90 day");
  });

  it("rejects a booking on a closed day", () => {
    // 2026-07-12 is a Sunday (disabled above).
    const error = validateBookingTime(new Date("2026-07-12T10:00:00"), WORKING_HOURS, SETTINGS, NOW);
    expect(error).toContain("closed");
  });

  it("rejects a booking before opening or ending after closing", () => {
    expect(validateBookingTime(new Date("2026-07-10T08:30:00"), WORKING_HOURS, { ...SETTINGS, minLeadTimeHours: 0 }, NOW)).toContain(
      "outside working hours"
    );
    // 16:45 + 30min slot ends past 17:00.
    expect(validateBookingTime(new Date("2026-07-10T16:45:00"), WORKING_HOURS, SETTINGS, NOW)).toContain(
      "outside working hours"
    );
  });

  it("rejects times not aligned to the slot grid", () => {
    const error = validateBookingTime(new Date("2026-07-10T10:15:00"), WORKING_HOURS, SETTINGS, NOW);
    expect(error).toContain("every 30 minutes");
  });

  it("rejects invalid dates", () => {
    expect(validateBookingTime(new Date("not-a-date"), WORKING_HOURS, SETTINGS, NOW)).toContain("Invalid");
  });
});

describe("validateCancellation", () => {
  it("allows cancelling well before the window", () => {
    expect(validateCancellation(new Date("2026-07-15T10:00:00"), 24, NOW)).toBeNull();
  });

  it("blocks cancelling inside the window", () => {
    const error = validateCancellation(new Date("2026-07-10T20:00:00"), 24, NOW);
    expect(error).toContain("within 24 hour");
  });

  it("allows cancelling past appointments (cleanup)", () => {
    expect(validateCancellation(new Date("2026-07-01T10:00:00"), 24, NOW)).toBeNull();
  });

  it("a zero window disables the check", () => {
    expect(validateCancellation(new Date("2026-07-10T09:00:00"), 0, NOW)).toBeNull();
  });
});
