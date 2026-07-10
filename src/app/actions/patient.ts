"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo, getTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import { findClinicDuplicate, duplicateMessage } from "@/lib/user-creation";
import {
  patientProfileUpdateSchema,
  type PatientProfileUpdateData,
} from "@/types/patient.types";
import { revalidatePath } from "next/cache";
import { requireCurrentPatient } from "@/lib/patient-auth";

/** The patient's own profile + patient record. */
export async function getMyPatientRecord() {
  const { tenant, patient } = await requireCurrentPatient();

  const profile = await prisma.profiles.findUnique({
    where: { id: tenant.profileId },
    select: { id: true, full_name: true, email: true, phone: true, role: true },
  });

  return { profile, patient };
}

/** Upcoming appointments for the logged-in patient (today onward). */
export async function getMyUpcomingAppointments() {
  const { tenant, patient } = await requireCurrentPatient();

  return prisma.appointments.findMany({
    where: {
      clinic_id: tenant.clinicId,
      patient_id: patient.id,
      appointment_date: { gte: new Date() },
    },
    include: {
      profiles: { select: { full_name: true, specialty: true } },
    },
    orderBy: { appointment_date: "asc" },
  });
}

/** Visit history: past encounters + past appointments for the patient. */
export async function getMyVisitHistory() {
  const { tenant, patient } = await requireCurrentPatient();

  const [encounters, pastAppointments] = await Promise.all([
    prisma.encounters.findMany({
      where: { clinic_id: tenant.clinicId, patient_id: patient.id },
      include: { profiles: { select: { full_name: true, specialty: true } } },
      orderBy: { encounter_date: "desc" },
      take: 100,
    }),
    prisma.appointments.findMany({
      where: {
        clinic_id: tenant.clinicId,
        patient_id: patient.id,
        appointment_date: { lt: new Date() },
      },
      include: { profiles: { select: { full_name: true, specialty: true } } },
      orderBy: { appointment_date: "desc" },
      take: 100,
    }),
  ]);

  return { encounters, pastAppointments };
}

/** Patient updates their own phone number (kept in sync on both rows). */
export async function updateMyProfile(data: PatientProfileUpdateData) {
  const parsed = patientProfileUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid data" };
  }

  const { tenant, patient } = await requireCurrentPatient();

  await prisma.$transaction([
    prisma.profiles.update({
      where: { id: tenant.profileId },
      data: { phone: parsed.data.phone },
    }),
    prisma.patients.update({
      where: { id: patient.id },
      data: { phone: parsed.data.phone },
    }),
  ]);

  revalidatePath("/patient/profile");
  return { success: true };
}

/**
 * Invite an existing patient (created without a login) to the portal: creates
 * their Supabase auth user, a `patient` profile, and links `patients.profile_id`.
 * Rolls back the auth user if the DB writes fail.
 */
export async function invitePatientToPortal(patientId: string) {
  try {
    const tenant = await requireTenantInfo();
    await requirePermission("patient.manage");

    const patient = await prisma.patients.findFirst({
      where: { id: patientId, clinic_id: tenant.clinicId },
    });

    if (!patient) return { error: "Patient not found." };
    if (patient.profile_id) {
      return { error: "This patient already has a portal account." };
    }
    if (!patient.email) {
      return { error: "This patient has no email address to invite." };
    }

    // Block duplicates within the clinic (another profile/patient with this
    // email or phone), excluding this patient's own record.
    const duplicate = await findClinicDuplicate({
      clinicId: tenant.clinicId,
      email: patient.email,
      phone: patient.phone,
      excludePatientId: patient.id,
    });
    if (duplicate) {
      return { error: duplicateMessage(duplicate) };
    }

    const fullName = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();

    let account;
    try {
      account = await createUserAccount({
        email: patient.email,
        metadata: { full_name: fullName, role: "patient", tenant_id: tenant.clinicId },
      });
    } catch (inviteError) {
      return {
        error:
          inviteError instanceof Error
            ? inviteError.message
            : "Failed to create patient account",
      };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const profile = await tx.profiles.upsert({
          where: { auth_user_id: account.user.id },
          update: {
            tenant_id: tenant.clinicId,
            full_name: fullName || null,
            email: patient.email,
            phone: patient.phone ?? null,
            role: "patient",
            status: "active",
            is_owner: false,
            is_profile_completed: false,
          },
          create: {
            auth_user_id: account.user.id,
            tenant_id: tenant.clinicId,
            full_name: fullName || null,
            email: patient.email,
            phone: patient.phone ?? null,
            role: "patient",
            status: "active",
            is_owner: false,
            is_profile_completed: false,
          },
        });

        await tx.patients.update({
          where: { id: patient.id },
          data: { profile_id: profile.id },
        });
      });
    } catch (dbError) {
      console.error("Portal invite failed, rolling back auth user:", dbError);
      await rollbackAuthUser(account.user.id);
      return { error: "Failed to link portal account. Rolled back." };
    }

    revalidatePath("/admin/patients");
    return { success: true, tempPassword: account.tempPassword };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/** Convenience for the portal layout guard: is the current user a patient? */
export async function getCurrentPatientRole(): Promise<string | null> {
  const tenant = await getTenantInfo();
  return tenant?.role ?? null;
}
