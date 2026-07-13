import { z } from "zod";

export const staffInviteSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  specialty: z.string().optional(),
});

export type StaffInviteFormData = z.infer<typeof staffInviteSchema>;

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

/** A single patient in the staff check-in / current queue. */
export interface StaffQueueItem {
  id: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  status: AppointmentStatus;
  /** Set once the patient is checked in; used to compute live wait-time. */
  checkedInAt: string | null;
}

/** One bar in the daily throughput chart (appointments grouped by status). */
export interface StaffThroughputPoint {
  status: AppointmentStatus;
  count: number;
}

/** A row in the staff booking-central appointment list. */
export interface StaffAppointmentRow {
  id: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  status: AppointmentStatus;
  /** Reason/notes, surfaced as the visit type; empty string when none. */
  visitType: string;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

/** A row in the staff billing invoice list. */
export interface StaffInvoiceRow {
  id: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  issuedAt: string;
  status: InvoiceStatus;
}

/** Aggregated, branch-scoped stats for the staff dashboard. */
export interface StaffDashboardStats {
  todaysAppointments: number;
  completedToday: number;
  remainingToday: number;
  checkedInQueue: number;
  newPatientsToday: number;
  paymentsCollectedToday: number;
  queue: StaffQueueItem[];
  throughput: StaffThroughputPoint[];
}

