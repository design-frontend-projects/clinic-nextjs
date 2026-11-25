import type {
  BookingCapabilities,
  BookingRoleScope,
  TimeSlotItem,
} from "@/types/booking.types";
import type { AppointmentStatus } from "@/types/staff.types";

export const SLOT_INTERVAL_MINUTES = 30;
export const CLINIC_START_HOUR = 8;
export const CLINIC_END_HOUR = 20;

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

/**
 * Generate the standard clinic 30-minute time slots (08:00 through 19:30) for
 * a local calendar day, annotated with occupied and past flags.
 */
export function buildDayTimeSlots(
  day: Date,
  occupiedDates: Date[],
  now = new Date(),
): TimeSlotItem[] {
  const slots: TimeSlotItem[] = [];
  const base = new Date(day);
  base.setHours(0, 0, 0, 0);

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
