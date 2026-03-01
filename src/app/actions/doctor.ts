"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
    prisma.prescription_dispenses.findMany({
      where: { patient_id: patientId, clinic_id: tenant.clinicId },
      orderBy: { dispensed_at: "desc" },
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
      treatment_plan: data.treatment_plan || null,
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
