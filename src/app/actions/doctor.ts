"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getDoctorDashboardStats() {
  const tenant = await requireTenantInfo();

  if (tenant.role !== "doctor") {
    throw new Error("Unauthorized: Only doctors can access this data");
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
          patients: { select: { first_name: true, last_name: true } },
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

export async function getDoctorAppointments(date?: string) {
  const tenant = await requireTenantInfo();

  if (tenant.role !== "doctor") {
    throw new Error("Unauthorized");
  }

  const where: Record<string, unknown> = {
    clinic_id: tenant.clinicId,
    doctor_id: tenant.profileId,
  };

  if (date) {
    const targetDate = new Date(date);
    where.appointment_date = {
      gte: new Date(targetDate.setHours(0, 0, 0, 0)),
      lt: new Date(targetDate.setHours(23, 59, 59, 999)),
    };
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
    orderBy: { appointment_date: "desc" },
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

  if (tenant.role !== "doctor") {
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

  if (tenant.role !== "doctor") {
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

/** Lab orders raised by the current doctor, newest first, for the lab-orders list. */
export async function getDoctorLabOrders() {
  const tenant = await requireTenantInfo();

  if (tenant.role !== "doctor") {
    throw new Error("Unauthorized");
  }

  return prisma.lab_orders.findMany({
    where: {
      clinic_id: tenant.clinicId,
      doctor_id: tenant.profileId,
    },
    include: {
      patients: { select: { first_name: true, last_name: true } },
      appointments: { select: { appointment_date: true, status: true } },
    },
    orderBy: { created_at: "desc" },
    take: 50,
  });
}
