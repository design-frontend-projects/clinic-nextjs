"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import { findClinicDuplicate, duplicateMessage } from "@/lib/user-creation";
import { createAppointmentWithPatientSchema, type CreateAppointmentWithPatientData } from "@/types/appointment.types";
import { getAppointmentSettings, getWorkingHours } from "@/lib/settings";
import { validateBookingTime, validateCancellation } from "@/features/settings/domain/booking-policy";

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

  // Block duplicate patient records within the clinic (by email or phone).
  const duplicate = await findClinicDuplicate({
    clinicId: tenant.clinicId,
    email: data.email,
    phone: data.phone,
  });
  if (duplicate) {
    throw new Error(duplicateMessage(duplicate));
  }

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

  // Enforce tenant scheduling policy (working hours, lead time, slot alignment).
  const appointmentDate = new Date(data.appointment_date);
  const [workingHours, appointmentSettings] = await Promise.all([
    getWorkingHours(),
    getAppointmentSettings(),
  ]);
  const policyError = validateBookingTime(appointmentDate, workingHours, appointmentSettings);
  if (policyError) {
    throw new Error(policyError);
  }

  const appointment = await prisma.appointments.create({
    data: {
      clinic_id: tenant.clinicId,
      branch_id: tenant.branchId,
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      appointment_date: appointmentDate,
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

  // Enforce the tenant's cancellation window.
  if (status === "cancelled") {
    const existing = await prisma.appointments.findFirst({
      where: { id, clinic_id: tenant.clinicId },
      select: { appointment_date: true },
    });
    if (existing) {
      const { cancellationWindowHours } = await getAppointmentSettings();
      const policyError = validateCancellation(existing.appointment_date, cancellationWindowHours);
      if (policyError) {
        throw new Error(policyError);
      }
    }
  }

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

    // Block duplicates within the clinic (by email or phone).
    const duplicate = await findClinicDuplicate({
      clinicId: tenant.clinicId,
      email: patientData.email,
      phone: patientData.phone,
    });
    if (duplicate) {
      return { error: duplicateMessage(duplicate) };
    }

    // Enforce tenant scheduling policy before creating any accounts.
    const [workingHours, appointmentSettings] = await Promise.all([
      getWorkingHours(),
      getAppointmentSettings(),
    ]);
    const policyError = validateBookingTime(
      new Date(appointmentData.appointment_date),
      workingHours,
      appointmentSettings
    );
    if (policyError) {
      return { error: policyError };
    }

    // Create the patient's confirmed auth user with a temp password
    let account;
    try {
      account = await createUserAccount({
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
        // 1. Upsert Profile (trigger pre-creates the row on auth-user insert)
        const profile = await tx.profiles.upsert({
          where: { auth_user_id: account.user.id },
          update: {
            tenant_id: tenant.clinicId,
            full_name: `${patientData.first_name} ${patientData.last_name}`.trim(),
            email: patientData.email,
            phone: patientData.phone ?? null,
            role: "patient",
            status: "active",
            is_owner: false,
            is_profile_completed: false,
          },
          create: {
            auth_user_id: account.user.id,
            tenant_id: tenant.clinicId,
            full_name: `${patientData.first_name} ${patientData.last_name}`.trim(),
            email: patientData.email,
            phone: patientData.phone ?? null,
            role: "patient",
            status: "active",
            is_owner: false,
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
      await rollbackAuthUser(account.user.id);
      return { error: "Failed to save patient records. Process rolled back." };
    }

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/patients");

    return { success: true, tempPassword: account.tempPassword };
  } catch (error: any) {
    console.error("Unexpected error in registerPatientAndCreateAppointment:", error);
    return { error: error.message || "An unexpected error occurred" };
  }
}
