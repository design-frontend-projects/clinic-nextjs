import type {
  BookingCapabilities,
  BookingRoleScope,
  BookingScopeRestriction,
  DoctorAvailabilityConfig,
  DoctorSlotDuration,
  SlotAvailabilityCheckResult,
  TimeSlotItem,
} from "@/types/booking.types";
import type { AppointmentStatus } from "@/types/staff.types";

export const SLOT_INTERVAL_MINUTES = 30;
export const CLINIC_START_HOUR = 8;
export const CLINIC_END_HOUR = 20;

export const DEFAULT_AVAILABLE_FROM = "09:00";
export const DEFAULT_AVAILABLE_TO = "17:00";
export const DEFAULT_AVAILABLE_DAYS = [0, 1, 2, 3, 4] as const;
export const ALLOWED_SLOT_DURATIONS = [15, 30] as const;

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Parse a 24-hour "HH:mm" string into minutes since midnight (0..1439).
 */
export function parseTimeToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const match = HH_MM_PATTERN.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return hours * 60 + minutes;
}

export interface RawDoctorAvailability {
  status?: string | null;
  available_from?: string | null;
  available_to?: string | null;
  slot_duration_minutes?: number | null;
  available_days?: number[] | null;
}

/**
 * Normalize raw DB/form availability fields into a deterministic config with
 * safe defaults for legacy records.
 */
export function normalizeDoctorAvailability(
  raw?: RawDoctorAvailability | null,
): DoctorAvailabilityConfig {
  const isActive = raw?.status ? raw.status === "active" : true;

  const parsedFrom = parseTimeToMinutes(raw?.available_from);
  const parsedTo = parseTimeToMinutes(raw?.available_to);
  const defaultFromMin = parseTimeToMinutes(DEFAULT_AVAILABLE_FROM)!;
  const defaultToMin = parseTimeToMinutes(DEFAULT_AVAILABLE_TO)!;

  let availableFrom =
    parsedFrom !== null ? raw!.available_from!.trim() : DEFAULT_AVAILABLE_FROM;
  let availableTo =
    parsedTo !== null ? raw!.available_to!.trim() : DEFAULT_AVAILABLE_TO;

  const fromMin = parseTimeToMinutes(availableFrom) ?? defaultFromMin;
  const toMin = parseTimeToMinutes(availableTo) ?? defaultToMin;
  if (toMin <= fromMin) {
    availableFrom = DEFAULT_AVAILABLE_FROM;
    availableTo = DEFAULT_AVAILABLE_TO;
  }

  const slotDurationMinutes: DoctorSlotDuration =
    raw?.slot_duration_minutes === 15 ? 15 : 30;

  let availableDays: number[];
  if (Array.isArray(raw?.available_days)) {
    const validDays = raw.available_days.filter(
      (d) => Number.isInteger(d) && d >= 0 && d <= 6,
    );
    availableDays = Array.from(new Set(validDays)).sort((a, b) => a - b);
  } else {
    availableDays = [...DEFAULT_AVAILABLE_DAYS];
  }

  return {
    isActive,
    availableFrom,
    availableTo,
    slotDurationMinutes,
    availableDays,
  };
}

/**
 * Check whether a doctor is active and scheduled to work on the given day's weekday.
 */
export function isDoctorWorkingOnDay(
  availability: DoctorAvailabilityConfig,
  day: Date,
): boolean {
  if (!availability.isActive) return false;
  return availability.availableDays.includes(day.getDay());
}

/**
 * Validate whether an appointment timestamp falls within an active doctor's
 * configured working days, working hours, and examination duration.
 */
export function validateDoctorSlotAvailability(
  availability: DoctorAvailabilityConfig,
  targetDate: Date,
): SlotAvailabilityCheckResult {
  if (!availability.isActive) {
    return {
      valid: false,
      reason: "inactive",
      message:
        "Selected doctor is currently inactive and unavailable for booking.",
    };
  }

  if (!availability.availableDays.includes(targetDate.getDay())) {
    return {
      valid: false,
      reason: "day_off",
      message: "Selected doctor is not available on this day of the week.",
    };
  }

  const startMin = parseTimeToMinutes(availability.availableFrom);
  const endMin = parseTimeToMinutes(availability.availableTo);
  if (startMin === null || endMin === null || endMin <= startMin) {
    return {
      valid: false,
      reason: "outside_hours",
      message: "Doctor availability schedule is not configured properly.",
    };
  }

  const targetMin = targetDate.getHours() * 60 + targetDate.getMinutes();
  if (
    targetMin < startMin ||
    targetMin + availability.slotDurationMinutes > endMin
  ) {
    return {
      valid: false,
      reason: "outside_hours",
      message: `Selected time is outside this doctor's working hours (${availability.availableFrom} - ${availability.availableTo}).`,
    };
  }

  return { valid: true };
}

export const TERMINAL_BOOKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "completed",
  "cancelled",
  "no_show",
]);

/**
 * Map a raw profile/effective role into one of the four booking authorization
 * scopes. `owner` and `super_admin` share `admin` capabilities; `receptionist`
 * shares `staff` capabilities.
 */
export function resolveBookingRoleScope(role: string): BookingRoleScope {
  if (role === "admin" || role === "owner" || role === "super_admin") {
    return "admin";
  }
  if (role === "doctor") {
    return "doctor";
  }
  if (role === "patient") {
    return "patient";
  }
  return "staff";
}

/**
 * Strictly monotonic scope restriction: narrows `"admin"` down to `"doctor"`
 * when a practitioner-only surface opts into doctor mode, while never
 * escalating `"doctor"`, `"staff"`, or `"patient"` scopes.
 */
export function applyBookingScopeRestriction(
  roleScope: BookingRoleScope,
  restriction?: BookingScopeRestriction,
): BookingRoleScope {
  if (restriction === "doctor" && roleScope === "admin") {
    return "doctor";
  }
  return roleScope;
}

export interface ComputeCapabilitiesParams {
  roleScope: BookingRoleScope;
  status: AppointmentStatus;
  appointmentDate: Date;
  canCreatePermission: boolean;
  canCancelPermission: boolean;
  branchLocked: boolean;
  now?: Date;
}

/**
 * Compute deterministic, role-scoped edit and status transition capabilities
 * for a single appointment row. Used by both server actions (enforcement) and
 * UI components (disabling/hiding actions).
 */
export function computeBookingCapabilities({
  roleScope,
  status,
  appointmentDate,
  canCreatePermission,
  canCancelPermission,
  branchLocked,
  now = new Date(),
}: ComputeCapabilitiesParams): BookingCapabilities {
  const isTerminal = TERMINAL_BOOKING_STATUSES.has(status);

  if (isTerminal) {
    if (roleScope === "admin") {
      return {
        canEditDetails: true,
        canReschedule: true,
        canChangeDoctor: true,
        canChangeBranch: !branchLocked,
        canCancel: status !== "cancelled",
        canCheckIn: true,
        canComplete: status !== "completed",
        canMarkNoShow: status !== "no_show",
        canOverrideTerminal: true,
        lockReason: null,
      };
    }

    return {
      canEditDetails: false,
      canReschedule: false,
      canChangeDoctor: false,
      canChangeBranch: false,
      canCancel: false,
      canCheckIn: false,
      canComplete: false,
      canMarkNoShow: false,
      canOverrideTerminal: false,
      lockReason: status as "completed" | "cancelled" | "no_show",
    };
  }

  if (roleScope === "patient") {
    if (status === "checked_in") {
      return {
        canEditDetails: false,
        canReschedule: false,
        canChangeDoctor: false,
        canChangeBranch: false,
        canCancel: false,
        canCheckIn: false,
        canComplete: false,
        canMarkNoShow: false,
        canOverrideTerminal: false,
        lockReason: "checked_in",
      };
    }

    if (appointmentDate.getTime() <= now.getTime()) {
      return {
        canEditDetails: false,
        canReschedule: false,
        canChangeDoctor: false,
        canChangeBranch: false,
        canCancel: false,
        canCheckIn: false,
        canComplete: false,
        canMarkNoShow: false,
        canOverrideTerminal: false,
        lockReason: "past",
      };
    }

    return {
      canEditDetails: true,
      canReschedule: true,
      canChangeDoctor: true,
      canChangeBranch: true,
      canCancel: true,
      canCheckIn: false,
      canComplete: false,
      canMarkNoShow: false,
      canOverrideTerminal: false,
      lockReason: null,
    };
  }

  if (roleScope === "staff") {
    const canEdit = canCreatePermission;
    return {
      canEditDetails: canEdit,
      canReschedule: canEdit,
      canChangeDoctor: canEdit,
      canChangeBranch: canEdit && !branchLocked,
      canCancel: canCancelPermission,
      canCheckIn: canEdit && status === "scheduled",
      canComplete: canEdit && (status === "scheduled" || status === "checked_in"),
      canMarkNoShow: canEdit && status === "scheduled",
      canOverrideTerminal: false,
      lockReason: !canEdit && !canCancelPermission ? "no_permission" : null,
    };
  }

  if (roleScope === "doctor") {
    return {
      canEditDetails: true,
      canReschedule: true,
      canChangeDoctor: false,
      canChangeBranch: !branchLocked,
      canCancel: true,
      canCheckIn: status === "scheduled",
      canComplete: status === "scheduled" || status === "checked_in",
      canMarkNoShow: status === "scheduled",
      canOverrideTerminal: false,
      lockReason: null,
    };
  }

  // admin (non-terminal)
  return {
    canEditDetails: true,
    canReschedule: true,
    canChangeDoctor: true,
    canChangeBranch: !branchLocked,
    canCancel: true,
    canCheckIn: status === "scheduled",
    canComplete: status === "scheduled" || status === "checked_in",
    canMarkNoShow: status === "scheduled",
    canOverrideTerminal: true,
    lockReason: null,
  };
}

/**
 * Returns `true` when `targetDate` falls strictly within `windowMinutes`
 * (default 30 minutes) of any active appointment timestamp in `existingDates`.
 */
export function hasDoctorSlotConflict(
  existingDates: Date[],
  targetDate: Date,
  windowMinutes = SLOT_INTERVAL_MINUTES,
): boolean {
  const windowMs = windowMinutes * 60_000;
  const targetMs = targetDate.getTime();
  return existingDates.some(
    (existing) => Math.abs(existing.getTime() - targetMs) < windowMs,
  );
}

export interface BuildDayTimeSlotsOptions {
  now?: Date;
  availability?: DoctorAvailabilityConfig;
}

/**
 * Generate time slots for a local calendar day, annotated with occupied and
 * past flags. When `availability` is provided, respects the doctor's active
 * status, working days, working hours (`availableFrom..availableTo`), and
 * examination duration (15 or 30 min). Otherwise uses the legacy 08:00-20:00
 * 30-minute clinic grid.
 */
export function buildDayTimeSlots(
  day: Date,
  occupiedDates: Date[],
  nowOrOptions?: Date | BuildDayTimeSlotsOptions,
): TimeSlotItem[] {
  const now =
    nowOrOptions instanceof Date
      ? nowOrOptions
      : (nowOrOptions?.now ?? new Date());
  const availability =
    nowOrOptions instanceof Date ? undefined : nowOrOptions?.availability;

  const base = new Date(day);
  base.setHours(0, 0, 0, 0);

  if (availability) {
    if (!isDoctorWorkingOnDay(availability, base)) {
      return [];
    }
    const startMin = parseTimeToMinutes(availability.availableFrom);
    const endMin = parseTimeToMinutes(availability.availableTo);
    if (startMin === null || endMin === null || endMin <= startMin) {
      return [];
    }

    const step = availability.slotDurationMinutes;
    const slots: TimeSlotItem[] = [];
    for (let mins = startMin; mins + step <= endMin; mins += step) {
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      const slotDate = new Date(base);
      slotDate.setHours(hour, minute, 0, 0);
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");

      slots.push({
        time: `${hh}:${mm}`,
        iso: slotDate.toISOString(),
        isOccupied: hasDoctorSlotConflict(occupiedDates, slotDate, step),
        isPast: slotDate.getTime() <= now.getTime(),
      });
    }
    return slots;
  }

  const slots: TimeSlotItem[] = [];
  for (let hour = CLINIC_START_HOUR; hour < CLINIC_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
      const slotDate = new Date(base);
      slotDate.setHours(hour, minute, 0, 0);
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");

      slots.push({
        time: `${hh}:${mm}`,
        iso: slotDate.toISOString(),
        isOccupied: hasDoctorSlotConflict(occupiedDates, slotDate),
        isPast: slotDate.getTime() <= now.getTime(),
      });
    }
  }

  return slots;
}
