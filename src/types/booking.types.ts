import { z } from "zod";
import { appointmentStatusEnum } from "@/types/appointment.types";
import type { AppointmentStatus } from "@/types/staff.types";

export type BookingRoleScope = "patient" | "staff" | "doctor" | "admin";

export type BookingLockReason =
  | "completed"
  | "cancelled"
  | "no_show"
  | "checked_in"
  | "past"
  | "no_permission"
  | null;

export interface BookingCapabilities {
  canEditDetails: boolean;
  canReschedule: boolean;
  canChangeDoctor: boolean;
  canChangeBranch: boolean;
  canCancel: boolean;
  canCheckIn: boolean;
  canComplete: boolean;
  canMarkNoShow: boolean;
  canOverrideTerminal: boolean;
  lockReason: BookingLockReason;
}

export interface BookingPartyPatient {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

export interface BookingPartyDoctor {
  id: string;
  fullName: string;
  specialty: string | null;
  email: string | null;
}

export interface BookingPartyBranch {
  id: string;
  name: string;
}

export interface BookingItem {
  id: string;
  appointmentDate: string;
  status: AppointmentStatus;
  notes: string | null;
  checkedInAt: string | null;
  patient: BookingPartyPatient;
  doctor: BookingPartyDoctor | null;
  branch: BookingPartyBranch | null;
  capabilities: BookingCapabilities;
}

export interface BookingDetail extends BookingItem {
  createdAt: string;
  updatedAt: string;
  encountersCount: number;
  labOrdersCount: number;
  hasReview: boolean;
}

export interface BookingDoctorOption {
  id: string;
  fullName: string;
  specialty: string | null;
  email: string | null;
  branchIds: string[];
}

export interface BookingBranchOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface BookingContextData {
  clinicId: string;
  clinicName: string;
  profileId: string;
  roleScope: BookingRoleScope;
  branchId: string | null;
  branchLocked: boolean;
  canCreate: boolean;
  canCancel: boolean;
  canCreateNewPatient: boolean;
  doctors: BookingDoctorOption[];
  branches: BookingBranchOption[];
}

export interface BookingListStats {
  todayCount: number;
  upcomingCount: number;
  scheduledCount: number;
  checkedInCount: number;
  completedCount: number;
  cancelledCount: number;
  totalCount: number;
}

export interface TimeSlotItem {
  time: string;
  iso: string;
  isOccupied: boolean;
  isPast: boolean;
}

export type BookingActionResult<T> =
  | { success: true; data: T }
  | { error: string };

export const bookingCreateSchema = z.object({
  patient_id: z.string().uuid("Please select a valid patient").optional(),
  doctor_id: z.string().uuid("Please select a doctor"),
  branch_id: z.string().uuid("Please select a valid branch").nullable().optional(),
  appointment_date: z.string().min(1, "Please select a date and time"),
  notes: z
    .string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .optional(),
});

export const bookingUpdateSchema = z.object({
  id: z.string().uuid("Invalid booking identifier"),
  doctor_id: z.string().uuid("Please select a doctor").optional(),
  branch_id: z.string().uuid("Please select a valid branch").nullable().optional(),
  appointment_date: z.string().min(1, "Please select a date and time").optional(),
  notes: z
    .string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .nullable()
    .optional(),
  status: appointmentStatusEnum.optional(),
});

export const bookingFiltersSchema = z.object({
  status: z.string().optional(),
  range: z.enum(["today", "upcoming", "all"]).optional(),
  date: z.string().optional(),
  doctorId: z.string().optional(),
  search: z.string().optional(),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
export type BookingFilters = z.infer<typeof bookingFiltersSchema>;
