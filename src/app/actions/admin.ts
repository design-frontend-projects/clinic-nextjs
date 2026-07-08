"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { inviteUser, deleteAuthUser } from "@/lib/invitations";
import { createAppointmentWithPatientSchema, type CreateAppointmentWithPatientData } from "@/types/appointment.types";

export async function getDashboardStats() {
  const tenant = await requireTenantInfo();
  const clinicId = tenant.clinicId;

  const [
    totalPatients,
    totalDoctors,
    todayAppointments,
    pendingPayments,
    recentAppointments,
  ] = await Promise.all([
    prisma.patients.count({ where: { clinic_id: clinicId } }),
    prisma.profiles.count({
      where: { tenant_id: clinicId, role: "doctor", status: "active" },
    }),
    prisma.appointments.count({
      where: {
        clinic_id: clinicId,
        appointment_date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.payments.count({
      where: {
        invoices: { clinic_id: clinicId },
        status: "pending",
      },
    }),
    prisma.appointments.findMany({
      where: { clinic_id: clinicId },
      include: {
        patients: { select: { first_name: true, last_name: true } },
        profiles: { select: { full_name: true } },
      },
      orderBy: { appointment_date: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalPatients,
    totalDoctors,
    todayAppointments,
    pendingPayments,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentAppointments: recentAppointments.map((a: any) => ({
      id: a.id,
      patientName:
        `${a.patients?.first_name || ""} ${a.patients?.last_name || ""}`.trim(),
      doctorName: a.profiles?.full_name || "Unassigned",
      date: a.appointment_date.toISOString(),
      status: a.status,
    })),
  };
}

export async function getPatients(search?: string) {
  const tenant = await requireTenantInfo();

  const patients = await prisma.patients.findMany({
    where: {
      clinic_id: tenant.clinicId,
      ...(search
        ? {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });

  return patients;
}

export async function createPatient(data: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
}) {
  const tenant = await requireTenantInfo();
  await requirePermission("patient.manage");

  const patient = await prisma.patients.create({
    data: {
      clinic_id: tenant.clinicId,
      branch_id: tenant.branchId,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      gender: data.gender as "male" | "female" | "other" | undefined,
      date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
      address: data.address || null,
    },
  });

  revalidatePath("/admin/patients");
  return patient;
}

export async function updatePatient(
  id: string,
  data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    gender?: string;
    date_of_birth?: string;
    address?: string;
  },
) {
  const tenant = await requireTenantInfo();
  await requirePermission("patient.manage");

  const patient = await prisma.patients.update({
    where: { id, clinic_id: tenant.clinicId },
    data: {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      gender: data.gender as "male" | "female" | "other" | undefined,
      date_of_birth: data.date_of_birth
        ? new Date(data.date_of_birth)
        : undefined,
      address: data.address,
    },
  });

  revalidatePath("/admin/patients");
  return patient;
}

export async function getDoctors() {
  const tenant = await requireTenantInfo();

  return prisma.profiles.findMany({
    where: {
      tenant_id: tenant.clinicId,
      role: "doctor",
    },
    orderBy: { created_at: "desc" },
  });
}

export async function getAppointments(filters?: {
  status?: string;
  date?: string;
}) {
  const tenant = await requireTenantInfo();

  const where: Record<string, unknown> = { clinic_id: tenant.clinicId };

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }

  if (filters?.date) {
    const date = new Date(filters.date);
    where.appointment_date = {
      gte: new Date(date.setHours(0, 0, 0, 0)),
      lt: new Date(date.setHours(23, 59, 59, 999)),
    };
  }

  return prisma.appointments.findMany({
    where,
    include: {
      patients: { select: { first_name: true, last_name: true, phone: true } },
      profiles: { select: { full_name: true, specialty: true } },
    },
    orderBy: { appointment_date: "desc" },
    take: 100,
  });
}

export async function createAppointment(data: {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  notes?: string;
}) {
  const tenant = await requireTenantInfo();
  await requirePermission("appointment.manage");

  const appointment = await prisma.appointments.create({
    data: {
      clinic_id: tenant.clinicId,
      branch_id: tenant.branchId,
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      appointment_date: new Date(data.appointment_date),
      notes: data.notes || null,
      status: "scheduled",
    },
  });

  revalidatePath("/admin/appointments");
  return appointment;
}

export async function updateAppointmentStatus(id: string, status: string) {
  const tenant = await requireTenantInfo();
  await requirePermission("appointment.manage");

  const appointment = await prisma.appointments.update({
    where: { id, clinic_id: tenant.clinicId },
    data: {
      status: status as
        | "scheduled"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "no_show",
    },
  });

  revalidatePath("/admin/appointments");
  return appointment;
}

export async function getInvoices() {
  const tenant = await requireTenantInfo();

  return prisma.invoices.findMany({
    where: { clinic_id: tenant.clinicId },
    include: {
      patients: { select: { first_name: true, last_name: true } },
      payments: true,
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });
}

export async function searchPatients(query: string) {
  const tenant = await requireTenantInfo();
  
  if (!query || query.length < 2) return [];

  return prisma.patients.findMany({
    where: {
      clinic_id: tenant.clinicId,
      OR: [
        { first_name: { contains: query, mode: "insensitive" } },
        { last_name: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
    },
    take: 10,
  });
}

export async function registerPatientAndCreateAppointment(data: CreateAppointmentWithPatientData) {
  try {
    const tenant = await requireTenantInfo();
    await requirePermission("appointment.manage");
    const parsed = createAppointmentWithPatientSchema.safeParse(data);
    
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid data" };
    }

    const patientData = parsed.data.patient;
    const appointmentData = parsed.data.appointment;

    // Create the patient's auth user and email them a set-password invite
    let authUser;
    try {
      authUser = await inviteUser({
        email: patientData.email,
        metadata: {
          full_name: `${patientData.first_name} ${patientData.last_name}`.trim(),
          role: "patient",
          tenant_id: tenant.clinicId,
        },
      });
    } catch (inviteError) {
      const message =
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to create patient account";
      return { error: message };
    }

    // Insert new profile, patient, and appointment in a transaction
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Create Profile
        const profile = await tx.profiles.create({
          data: {
            auth_user_id: authUser.id,
            tenant_id: tenant.clinicId,
            full_name: `${patientData.first_name} ${patientData.last_name}`.trim(),
            email: patientData.email,
            phone: patientData.phone ?? null,
            role: "patient",
            status: "active",
            is_profile_completed: false,
          },
        });

        // 2. Create Patient Record
        const patient = await tx.patients.create({
          data: {
            clinic_id: tenant.clinicId,
            branch_id: tenant.branchId,
            profile_id: profile.id,
            first_name: patientData.first_name,
            last_name: patientData.last_name,
            email: patientData.email,
            phone: patientData.phone ?? null,
            gender: patientData.gender as "male" | "female" | "other" | undefined,
            date_of_birth: patientData.date_of_birth ? new Date(patientData.date_of_birth) : null,
            address: patientData.address ?? null,
          },
        });

        // 3. Create Appointment
        await tx.appointments.create({
          data: {
            clinic_id: tenant.clinicId,
            branch_id: tenant.branchId,
            patient_id: patient.id,
            doctor_id: appointmentData.doctor_id,
            appointment_date: new Date(appointmentData.appointment_date),
            notes: appointmentData.notes ?? null,
            status: appointmentData.status as any,
          },
        });
      });
    } catch (dbError) {
      // Rollback auth user if DB operations fail
      console.error("Database operations failed, rolling back auth user:", dbError);
      await deleteAuthUser(authUser.id);
      return { error: "Failed to save patient records. Process rolled back." };
    }

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/patients");
    
    return { success: true };
  } catch (error: any) {
    console.error("Unexpected error in registerPatientAndCreateAppointment:", error);
    return { error: error.message || "An unexpected error occurred" };
  }
}
