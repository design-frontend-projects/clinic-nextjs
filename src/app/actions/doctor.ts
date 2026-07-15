"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { DOCTOR_PAGE_ROLES } from "@/types/clinic.types";
import type { DoctorReview, DoctorReviewStats } from "@/types/review.types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * A practitioner is a role that sees appointments assigned to them personally
 * (`appointments.doctor_id === profileId`): doctors and clinic owners who also
 * practice. Kept in sync with `DOCTOR_PAGE_ROLES`.
 */
function isPractitioner(role: string): boolean {
  return (DOCTOR_PAGE_ROLES as readonly string[]).includes(role);
}

export async function getDoctorDashboardStats() {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    throw new Error("Unauthorized: Only practitioners can access this data");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [todayAppointments, pendingLabResults, recentPatients] =
    await Promise.all([
      prisma.appointments.findMany({
        where: {
          clinic_id: tenant.clinicId,
          doctor_id: tenant.profileId,
          appointment_date: {
            gte: today,
            lt: endOfDay,
          },
        },
        include: {
          patients: { select: { id: true, first_name: true, last_name: true } },
        },
        orderBy: { appointment_date: "asc" },
      }),
      prisma.lab_orders.count({
        where: {
          clinic_id: tenant.clinicId,
          doctor_id: tenant.profileId,
          status: { in: ["pending", "processing"] },
        },
      }),
      prisma.appointments.findMany({
        where: {
          clinic_id: tenant.clinicId,
          doctor_id: tenant.profileId,
          status: "completed",
        },
        include: {
          patients: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              phone: true,
            },
          },
        },
        orderBy: { appointment_date: "desc" },
        take: 5,
      }),
    ]);

  return {
    todayCount: todayAppointments.length,
    pendingLabCount: pendingLabResults,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    todayAppointments: todayAppointments.map((a: any) => ({
      id: a.id,
      patientId: a.patients?.id ?? null,
      patientName:
        `${a.patients?.first_name || ""} ${a.patients?.last_name || ""}`.trim(),
      date: a.appointment_date.toISOString(),
      status: a.status,
      notes: a.notes,
    })),
    recentPatients: Array.from(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Set(recentPatients.map((a: any) => a.patients?.id)),
    )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((id: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apt = recentPatients.find((a: any) => a.patients?.id === id);
        return {
          id: apt?.patients?.id,
          name: `${apt?.patients?.first_name || ""} ${apt?.patients?.last_name || ""}`.trim(),
          phone: apt?.patients?.phone,
          lastVisit: apt?.appointment_date.toISOString(),
        };
      })
      .slice(0, 5),
  };
}

export interface DoctorAppointmentsFilter {
  /** Quick date scope. Ignored when a specific `date` is provided. */
  mode?: "today" | "upcoming" | "all";
  /** A specific calendar day (ISO string); overrides `mode`. */
  date?: string;
  /** Concrete appointment status; omit or "all" for no status filter. */
  status?: string;
}

export async function getDoctorAppointments(filter?: DoctorAppointmentsFilter) {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    throw new Error("Unauthorized");
  }

  const where: Record<string, unknown> = {
    clinic_id: tenant.clinicId,
    doctor_id: tenant.profileId,
  };

  const { mode = "all", date, status } = filter ?? {};

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.appointment_date = { gte: start, lt: end };
  } else if (mode === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    where.appointment_date = { gte: start, lt: end };
  } else if (mode === "upcoming") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    where.appointment_date = { gte: start };
  }

  if (status && status !== "all") {
    where.status = status;
  }

  return prisma.appointments.findMany({
    where,
    include: {
      patients: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          date_of_birth: true,
          gender: true,
        },
      },
    },
    orderBy: { appointment_date: "asc" },
    take: 50,
  });
}

export async function getPatientDetails(patientId: string) {
  const tenant = await requireTenantInfo();

  const patient = await prisma.patients.findUnique({
    where: {
      id: patientId,
      clinic_id: tenant.clinicId,
    },
  });

  if (!patient) throw new Error("Patient not found");

  const [history, prescriptions, labOrders] = await Promise.all([
    prisma.encounters.findMany({
      where: { patient_id: patientId, clinic_id: tenant.clinicId },
      include: {
        profiles: { select: { full_name: true } }, // doctor name
      },
      orderBy: { encounter_date: "desc" },
    }),
    prisma.prescriptions.findMany({
      where: { patient_id: patientId, clinic_id: tenant.clinicId },
      include: { prescription_items: true },
      orderBy: { issued_at: "desc" },
    }),
    prisma.lab_orders.findMany({
      where: { patient_id: patientId, clinic_id: tenant.clinicId },
      include: { lab_results: true },
      orderBy: { created_at: "desc" },
    }),
  ]);

  return {
    patient,
    history,
    prescriptions,
    labOrders,
  };
}

export async function createEncounter(
  patientId: string,
  data: {
    appointment_id?: string;
    notes: string;
    diagnosis?: string;
    treatment_plan?: string;
  },
) {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    throw new Error("Unauthorized");
  }

  const encounter = await prisma.encounters.create({
    data: {
      clinic_id: tenant.clinicId,
      branch_id: tenant.branchId,
      patient_id: patientId,
      doctor_id: tenant.profileId,
      appointment_id: data.appointment_id || null,
      encounter_date: new Date(),
      notes: data.notes,
      diagnosis: data.diagnosis || null,
    },
  });

  if (data.appointment_id) {
    await prisma.appointments.update({
      where: { id: data.appointment_id },
      data: { status: "completed" },
    });
  }

  revalidatePath(`/admin/patients/${patientId}`);
  revalidatePath(`/doctor/patients/${patientId}`);
  return encounter;
}

const createLabOrderSchema = z.object({
  appointment_id: z.string().uuid(),
  test_name: z.string().trim().min(1, "Test name is required"),
  external_lab_provider: z.string().trim().min(1).optional(),
});

export type CreateLabOrderInput = z.infer<typeof createLabOrderSchema>;

/**
 * Create a lab request tied to an appointment. Only doctors may call this, and
 * only for appointments that are NOT completed — a completed visit is closed for
 * new lab requests. Enforced server-side, not just in the UI.
 */
export async function createLabOrder(input: CreateLabOrderInput) {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = createLabOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const appointment = await prisma.appointments.findFirst({
    where: {
      id: data.appointment_id,
      clinic_id: tenant.clinicId,
      doctor_id: tenant.profileId,
    },
    select: { id: true, status: true, patient_id: true, branch_id: true },
  });

  if (!appointment) {
    return { error: "Appointment not found" };
  }

  if (appointment.status === "completed") {
    return { error: "Cannot add a lab request for a completed appointment" };
  }

  const labOrder = await prisma.lab_orders.create({
    data: {
      clinic_id: tenant.clinicId,
      branch_id: appointment.branch_id ?? tenant.branchId,
      patient_id: appointment.patient_id,
      doctor_id: tenant.profileId,
      appointment_id: appointment.id,
      test_name: data.test_name,
      external_lab_provider: data.external_lab_provider ?? null,
      status: "ordered",
    },
  });

  revalidatePath(`/doctor/lab-orders`);
  revalidatePath(`/doctor/appointments`);
  revalidatePath(`/doctor/patients/${appointment.patient_id}`);
  return { success: true, labOrder };
}

/**
 * Lab orders raised by the current practitioner, newest first, for the
 * lab-orders list. Pass `appointmentId` to scope the list to a single
 * appointment (used by the "View Labs" deep-link from the appointments table).
 */
export async function getDoctorLabOrders(appointmentId?: string) {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    throw new Error("Unauthorized");
  }

  return prisma.lab_orders.findMany({
    where: {
      clinic_id: tenant.clinicId,
      doctor_id: tenant.profileId,
      ...(appointmentId ? { appointment_id: appointmentId } : {}),
    },
    include: {
      patients: { select: { first_name: true, last_name: true } },
      appointments: { select: { appointment_date: true, status: true } },
    },
    orderBy: { created_at: "desc" },
    take: 50,
  });
}

export async function getDoctorPatients(search?: string) {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    throw new Error("Unauthorized");
  }

  const patients = await prisma.patients.findMany({
    where: {
      clinic_id: tenant.clinicId,
      deleted_at: null,
      ...(search
        ? {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      encounters: {
        orderBy: { encounter_date: "desc" },
        take: 1,
      },
      appointments: {
        where: {
          doctor_id: tenant.profileId,
        },
        orderBy: { appointment_date: "desc" },
        take: 1,
      },
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });

  return patients.map((p) => {
    const latestEncounter = p.encounters[0];
    const latestAppt = p.appointments[0];
    return {
      id: p.id,
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unnamed Patient",
      gender: p.gender,
      dob: p.date_of_birth ? p.date_of_birth.toISOString() : null,
      phone: p.phone || "—",
      email: p.email || "—",
      condition: latestEncounter?.diagnosis || "No diagnosis",
      last_visit: latestAppt?.appointment_date
        ? latestAppt.appointment_date.toISOString()
        : latestEncounter?.encounter_date
        ? latestEncounter.encounter_date.toISOString()
        : p.created_at.toISOString(),
    };
  });
}


/**
 * Aggregate rating summary for the current doctor's own approved reviews.
 * Scoped to the tenant + the doctor themself.
 */
export async function getDoctorReviewStats(): Promise<DoctorReviewStats> {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    throw new Error("Unauthorized: Only practitioners can access this data");
  }

  const result = await prisma.appointment_reviews.aggregate({
    where: {
      clinic_id: tenant.clinicId,
      doctor_id: tenant.profileId,
      status: "approved",
    },
    _avg: { rating: true },
    _count: true,
  });

  return {
    average: Math.round((result._avg.rating ?? 0) * 10) / 10,
    count: result._count,
  };
}

/**
 * The current doctor's own approved reviews, most recently approved first.
 * Scoped to the tenant + the doctor themself.
 */
export async function getDoctorReviews(limit?: number): Promise<DoctorReview[]> {
  const tenant = await requireTenantInfo();

  if (!isPractitioner(tenant.role)) {
    throw new Error("Unauthorized: Only practitioners can access this data");
  }

  const reviews = await prisma.appointment_reviews.findMany({
    where: {
      clinic_id: tenant.clinicId,
      doctor_id: tenant.profileId,
      status: "approved",
    },
    orderBy: { approved_at: "desc" },
    take: limit ?? 100,
    select: {
      id: true,
      rating: true,
      comment: true,
      created_at: true,
      approved_at: true,
      appointments: { select: { appointment_date: true } },
      patients: { select: { first_name: true, last_name: true } },
    },
  });

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: (r.approved_at ?? r.created_at).toISOString(),
    appointment_date: r.appointments.appointment_date?.toISOString() ?? null,
    patient_name:
      [r.patients.first_name, r.patients.last_name].filter(Boolean).join(" ") ||
      "Patient",
  }));
}
