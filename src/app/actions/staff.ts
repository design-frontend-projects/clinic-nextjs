"use server";

import { getSupabaseSession, requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import { findClinicDuplicate, duplicateMessage } from "@/lib/user-creation";
import {
  staffInviteSchema,
  type StaffInviteFormData,
  type AppointmentStatus,
  type InvoiceStatus,
  type StaffQueueItem,
  type StaffDashboardStats,
  type StaffThroughputPoint,
  type StaffAppointmentRow,
  type StaffInvoiceRow,
} from "@/types/staff.types";
import type { CreateAppointmentWithPatientData } from "@/types/appointment.types";
import {
  createAppointmentForScope,
  registerPatientWithAppointmentForScope,
  type AppointmentScope,
  type RegisterPatientResult,
} from "@/lib/appointment-service";
import { revalidatePath } from "next/cache";

const ALL_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
];

/** Staff are branch-locked; scope every query to their branch when one is set. */
function scopedWhere(scope: AppointmentScope): {
  clinic_id: string;
  branch_id?: string;
} {
  return {
    clinic_id: scope.clinicId,
    ...(scope.branchId ? { branch_id: scope.branchId } : {}),
  };
}

function todayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Local-day [start, end] window for a specific calendar date (ISO string). */
function dayRange(dateIso: string): { start: Date; end: Date } {
  const start = new Date(dateIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateIso);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function fullName(
  first: string | null,
  last: string | null,
  fallback: string,
): string {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || fallback;
}

/** Revalidate every staff route that renders appointment/queue data. */
function revalidateStaffRoutes(): void {
  revalidatePath("/staff");
  revalidatePath("/staff/checkin");
  revalidatePath("/staff/booking");
}

/**
 * NOTE: Legacy standalone staff-invite action; the live staff path is
 * `upsertPersonnel` in `personnel.ts`. Kept in sync with the new
 * create-user + duplicate-check flow but intentionally minimal (no RBAC role
 * picker) since no UI currently calls it.
 */

export async function inviteStaffMember(data: StaffInviteFormData) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };

    const parsed = staffInviteSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid data" };

    // Get current user's clinic to assign the staff member to
    const doctorProfile = await prisma.profiles.findUnique({
      where: { auth_user_id: session.user.id },
      select: { tenant_id: true },
    });

    const tenantId = doctorProfile?.tenant_id;
    if (!tenantId) {
      return { error: "You must complete onboarding and have a clinic first." };
    }

    // Block duplicates within the clinic (by email).
    const duplicate = await findClinicDuplicate({
      clinicId: tenantId,
      email: parsed.data.email,
    });
    if (duplicate) {
      return { error: duplicateMessage(duplicate) };
    }

    // Create the confirmed auth user with a temp password (Supabase admin).
    let account;
    try {
      account = await createUserAccount({
        email: parsed.data.email,
        metadata: {
          full_name: parsed.data.full_name,
          role: "staff",
          tenant_id: tenantId,
        },
      });
    } catch (inviteError) {
      const message =
        inviteError instanceof Error ? inviteError.message : "Failed to create user";
      return { error: message };
    }

    // 2. Upsert profile mapped to the tenant (trigger pre-creates the row)
    try {
      await prisma.profiles.upsert({
        where: { auth_user_id: account.user.id },
        update: {
          tenant_id: tenantId,
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          role: "staff",
          specialty: parsed.data.specialty || null,
          status: "active",
          is_owner: false,
          is_profile_completed: false,
        },
        create: {
          auth_user_id: account.user.id,
          tenant_id: tenantId,
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          role: "staff",
          specialty: parsed.data.specialty || null,
          status: "active",
          is_owner: false,
          is_profile_completed: false,
        },
      });
    } catch (profileError) {
      // Orphan prevention: delete the auth user if profile creation fails
      console.error("Profile creation failed, rolling back auth user:", profileError);
      await rollbackAuthUser(account.user.id);
      return { error: "Failed to create staff profile. Rolled back." };
    }

    revalidatePath("/admin/staff");
    return { success: true, tempPassword: account.tempPassword };
  } catch (error) {
    console.error("Error inviting staff:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Build the branch-scoped queue of patients that are scheduled or already
 * checked in for today, ordered by appointment time. Shared by the dashboard and
 * the check-in page.
 */
async function fetchStaffQueue(
  scope: AppointmentScope,
  take: number,
): Promise<StaffQueueItem[]> {
  const { start, end } = todayRange();

  const rows = await prisma.appointments.findMany({
    where: {
      ...scopedWhere(scope),
      appointment_date: { gte: start, lt: end },
      status: { in: ["scheduled", "checked_in"] },
    },
    include: {
      patients: { select: { first_name: true, last_name: true } },
      profiles: { select: { full_name: true } },
    },
    orderBy: { appointment_date: "asc" },
    take,
  });

  return rows.map((a) => ({
    id: a.id,
    patientName: fullName(
      a.patients?.first_name ?? null,
      a.patients?.last_name ?? null,
      "Unknown patient",
    ),
    doctorName: a.profiles?.full_name || "Unassigned",
    appointmentDate: a.appointment_date.toISOString(),
    status: a.status as AppointmentStatus,
    checkedInAt: a.checked_in_at ? a.checked_in_at.toISOString() : null,
  }));
}

/** Full check-in queue for the staff check-in page (branch-scoped, today). */
export async function getStaffQueue(): Promise<StaffQueueItem[]> {
  const tenant = await requireTenantInfo();
  await requirePermission("appointment.read");
  return fetchStaffQueue(tenant, 100);
}

/** Aggregated, branch-scoped stats for the staff dashboard. */
export async function getStaffDashboardStats(): Promise<StaffDashboardStats> {
  const tenant = await requireTenantInfo();
  await requirePermission("appointment.read");

  const scope = scopedWhere(tenant);
  const { start, end } = todayRange();
  const todayAppointmentWhere = {
    ...scope,
    appointment_date: { gte: start, lt: end },
  };

  const [
    todaysAppointments,
    completedToday,
    checkedInQueue,
    newPatientsToday,
    paymentsAgg,
    statusGroups,
    queue,
  ] = await Promise.all([
    prisma.appointments.count({ where: todayAppointmentWhere }),
    prisma.appointments.count({
      where: { ...todayAppointmentWhere, status: "completed" },
    }),
    prisma.appointments.count({
      where: { ...todayAppointmentWhere, status: "checked_in" },
    }),
    prisma.patients.count({
      where: { ...scope, created_at: { gte: start, lt: end } },
    }),
    prisma.payments.aggregate({
      _sum: { amount: true },
      where: {
        clinic_id: tenant.clinicId,
        status: "paid",
        paid_at: { gte: start, lt: end },
        ...(tenant.branchId
          ? { invoices: { branch_id: tenant.branchId } }
          : {}),
      },
    }),
    prisma.appointments.groupBy({
      by: ["status"],
      where: todayAppointmentWhere,
      _count: { _all: true },
    }),
    fetchStaffQueue(tenant, 10),
  ]);

  const countByStatus = new Map(
    statusGroups.map((g) => [g.status as AppointmentStatus, g._count._all]),
  );
  const throughput: StaffThroughputPoint[] = ALL_STATUSES.map((status) => ({
    status,
    count: countByStatus.get(status) ?? 0,
  }));

  const remainingToday = Math.max(todaysAppointments - completedToday, 0);

  return {
    todaysAppointments,
    completedToday,
    remainingToday,
    checkedInQueue,
    newPatientsToday,
    paymentsCollectedToday: Number(paymentsAgg._sum.amount ?? 0),
    queue,
    throughput,
  };
}

/** Date scope for the staff appointment list: a whole day, today, or today+future. */
export type StaffAppointmentRange = "all" | "today" | "upcoming";

/**
 * Resolve the `appointment_date` filter. A specific `date` (a picked calendar
 * day) takes precedence over `range`. `upcoming` means today + future
 * (`appointment_date >= now`); `today` is the current local day.
 */
function appointmentDateWhere(
  range: StaffAppointmentRange,
  date?: string,
): { gte?: Date; lt?: Date; lte?: Date } | undefined {
  if (date) {
    const { start, end } = dayRange(date);
    return { gte: start, lte: end };
  }
  if (range === "today") {
    const { start, end } = todayRange();
    return { gte: start, lte: end };
  }
  if (range === "upcoming") {
    return { gte: new Date() };
  }
  return undefined;
}

/** Branch-scoped appointment list for the staff booking-central page. */
export async function getStaffAppointments(filters?: {
  status?: string;
  range?: StaffAppointmentRange;
  date?: string;
}): Promise<StaffAppointmentRow[]> {
  const tenant = await requireTenantInfo();
  await requirePermission("appointment.read");

  const range = filters?.range ?? "all";
  const dateWhere = appointmentDateWhere(range, filters?.date);

  const where = {
    ...scopedWhere(tenant),
    ...(filters?.status && filters.status !== "all"
      ? { status: filters.status as AppointmentStatus }
      : {}),
    ...(dateWhere ? { appointment_date: dateWhere } : {}),
  };

  // Chronological (soonest first) when scoped to a date/today/upcoming;
  // newest first when browsing the full history.
  const orderDir = filters?.date || range !== "all" ? "asc" : "desc";

  const rows = await prisma.appointments.findMany({
    where,
    include: {
      patients: { select: { first_name: true, last_name: true } },
      profiles: { select: { full_name: true } },
    },
    orderBy: { appointment_date: orderDir },
    take: 100,
  });

  return rows.map((a) => ({
    id: a.id,
    patientName: fullName(
      a.patients?.first_name ?? null,
      a.patients?.last_name ?? null,
      "Unknown patient",
    ),
    doctorName: a.profiles?.full_name || "Unassigned",
    appointmentDate: a.appointment_date.toISOString(),
    status: a.status as AppointmentStatus,
    visitType: a.notes ?? "",
  }));
}

/** Branch-scoped invoice list for the staff billing page (read-only). */
export async function getStaffInvoices(): Promise<StaffInvoiceRow[]> {
  const tenant = await requireTenantInfo();
  await requirePermission("invoice.read");

  const rows = await prisma.invoices.findMany({
    where: scopedWhere(tenant),
    include: {
      patients: { select: { first_name: true, last_name: true } },
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });

  return rows.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number || inv.id.slice(0, 8).toUpperCase(),
    patientName: fullName(
      inv.patients?.first_name ?? null,
      inv.patients?.last_name ?? null,
      "Unknown patient",
    ),
    amount: Number(inv.total_amount ?? 0),
    issuedAt: inv.created_at.toISOString(),
    status: inv.status as InvoiceStatus,
  }));
}

/** Book an appointment for an existing patient (front-desk create permission). */
export async function createStaffAppointment(data: {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  notes?: string;
}) {
  const tenant = await requireTenantInfo();
  await requirePermission("appointment.create");
  const appointment = await createAppointmentForScope(tenant, data);
  revalidateStaffRoutes();
  return appointment;
}

/** Register a new patient and book their appointment in one flow. */
export async function registerPatientAndCreateStaffAppointment(
  data: CreateAppointmentWithPatientData,
): Promise<RegisterPatientResult> {
  try {
    const tenant = await requireTenantInfo();
    await requirePermission("appointment.create");

    const result = await registerPatientWithAppointmentForScope(tenant, data);
    if ("success" in result) {
      revalidateStaffRoutes();
      revalidatePath("/staff/patients");
    }
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/** Check a patient in: flip to `checked_in` and stamp the check-in time. */
export async function checkInStaffAppointment(id: string) {
  const tenant = await requireTenantInfo();
  await requirePermission("appointment.create");

  const appointment = await prisma.appointments.update({
    where: { id, clinic_id: tenant.clinicId },
    data: { status: "checked_in", checked_in_at: new Date() },
  });

  revalidateStaffRoutes();
  return appointment;
}

/** Progress an appointment through the queue (check-in, complete, cancel, …). */
export async function updateStaffAppointmentStatus(
  id: string,
  status: AppointmentStatus,
) {
  const tenant = await requireTenantInfo();
  // Cancelling is a distinct front-desk permission; other transitions ride on
  // the create/scheduling permission staff already hold.
  await requirePermission(
    status === "cancelled" ? "appointment.cancel" : "appointment.create",
  );

  const appointment = await prisma.appointments.update({
    where: { id, clinic_id: tenant.clinicId },
    data: {
      status,
      ...(status === "checked_in" ? { checked_in_at: new Date() } : {}),
    },
  });

  revalidateStaffRoutes();
  return appointment;
}
