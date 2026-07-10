// src/features/settings/domain/booking-policy.ts
// Pure booking-policy checks driven by tenant settings (unit-testable, no I/O).
// NOTE: appointment times are interpreted in the server's local time, matching
// how booking forms submit datetime-local strings today. A future iteration can
// layer localization.timezone on top.
import type { AppointmentSettings, WeekDay, WeeklySchedule } from "./models";
import { WEEK_DAYS } from "./models";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function dayOfWeek(date: Date): WeekDay {
  // getDay(): 0 = Sunday ... 6 = Saturday
  const byGetDay: WeekDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return byGetDay[date.getDay()];
}

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Validates a prospective appointment start time against working hours and
 * appointment settings. Returns an error message, or null when bookable.
 */
export function validateBookingTime(
  appointmentDate: Date,
  workingHours: WeeklySchedule,
  settings: AppointmentSettings,
  now: Date = new Date()
): string | null {
  if (Number.isNaN(appointmentDate.getTime())) {
    return "Invalid appointment date";
  }

  const leadMs = appointmentDate.getTime() - now.getTime();
  if (leadMs < settings.minLeadTimeHours * MS_PER_HOUR) {
    return `Appointments must be booked at least ${settings.minLeadTimeHours} hour(s) in advance`;
  }
  if (leadMs > settings.maxAdvanceDays * MS_PER_DAY) {
    return `Appointments cannot be booked more than ${settings.maxAdvanceDays} day(s) ahead`;
  }

  const day = dayOfWeek(appointmentDate);
  const schedule = workingHours[day];
  if (!schedule || !schedule.enabled) {
    return "The clinic is closed on the selected day";
  }

  const startMinutes = minutesSinceMidnight(schedule.start);
  const endMinutes = minutesSinceMidnight(schedule.end);
  const appointmentMinutes = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();

  if (
    appointmentMinutes < startMinutes ||
    appointmentMinutes + settings.slotDurationMinutes > endMinutes
  ) {
    return `The selected time is outside working hours (${schedule.start}–${schedule.end})`;
  }

  if ((appointmentMinutes - startMinutes) % settings.slotDurationMinutes !== 0) {
    return `Appointments start every ${settings.slotDurationMinutes} minutes from ${schedule.start}`;
  }

  return null;
}

/**
 * Validates cancelling an appointment against the cancellation window.
 * Returns an error message, or null when cancellation is allowed.
 */
export function validateCancellation(
  appointmentDate: Date,
  cancellationWindowHours: number,
  now: Date = new Date()
): string | null {
  if (cancellationWindowHours <= 0) return null;
  // Past appointments can always be cancelled (cleanup / no-show handling).
  const remainingMs = appointmentDate.getTime() - now.getTime();
  if (remainingMs > 0 && remainingMs < cancellationWindowHours * MS_PER_HOUR) {
    return `Appointments cannot be cancelled within ${cancellationWindowHours} hour(s) of the start time`;
  }
  return null;
}

/** True when the schedule has at least one open day (sanity guard for seeds). */
export function hasOpenDay(workingHours: WeeklySchedule): boolean {
  return WEEK_DAYS.some((day) => workingHours[day]?.enabled);
}
