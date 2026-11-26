"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo, getTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findClinicDuplicate,
  duplicateMessage,
  generateTempPassword,
} from "@/lib/user-creation";
import { revalidatePath } from "next/cache";
import { requireCurrentPatient } from "@/lib/patient-auth";
import {
  setPatientPasswordSchema,
  type PatientOverview,
  type SetPatientPasswordInput,
} from "@/types/patient.types";

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

/**
 * Invite an existing patient (created without a login) to the portal: creates
 * their Supabase auth user, a `patient` profile, and links `patients.profile_id`.
 * Rolls back the auth user if the DB writes fail.
 */
export async function invitePatientToPortal(patientId: string) {
  try {
    const tenant = await requireTenantInfo();
    await requirePermission("patient.update");

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
    revalidatePath("/staff/patients");
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

const PASSWORD_MANAGER_ROLES = ["owner", "doctor"] as const;

function isPatientPasswordManager(
  tenant: { is_owner?: boolean; role?: string | null } | null,
): boolean {
  if (!tenant) return false;
  return (
    Boolean(tenant.is_owner) ||
    PASSWORD_MANAGER_ROLES.includes(
      tenant.role as (typeof PASSWORD_MANAGER_ROLES)[number],
    )
  );
}

async function requirePatientPasswordManager() {
  const tenant = await requireTenantInfo();
  if (!isPatientPasswordManager(tenant)) {
    throw new Error(
      "Forbidden: only owners and doctors can manage patient passwords.",
    );
  }
  return tenant;
}

/** Client hint for whether the current user can reset/set patient passwords. */
export async function canManagePatientPasswords(): Promise<boolean> {
  try {
    const tenant = await getTenantInfo();
    return isPatientPasswordManager(tenant);
  } catch {
    return false;
  }
}

/** Overview data for the patient details modal (clinic-scoped, read-only). */
export async function getPatientOverview(
  patientId: string,
): Promise<PatientOverview> {
  const tenant = await requireTenantInfo();
  await requirePermission("patient.read");

  const patient = await prisma.patients.findFirst({
    where: { id: patientId, clinic_id: tenant.clinicId },
    include: {
      profiles: {
        select: {
          id: true,
          auth_user_id: true,
          email: true,
          status: true,
        },
      },
    },
  });

  if (!patient) {
    throw new Error("Patient not found.");
  }

  const [
    appointments,
    encounters,
    appointmentsCount,
    encountersCount,
    lastSignInAt,
  ] = await Promise.all([
    prisma.appointments.findMany({
      where: { clinic_id: tenant.clinicId, patient_id: patientId },
      include: { profiles: { select: { full_name: true } } },
      orderBy: { appointment_date: "desc" },
      take: 10,
    }),
    prisma.encounters.findMany({
      where: { clinic_id: tenant.clinicId, patient_id: patientId },
      include: { profiles: { select: { full_name: true } } },
      orderBy: { encounter_date: "desc" },
      take: 10,
    }),
    prisma.appointments.count({
      where: { clinic_id: tenant.clinicId, patient_id: patientId },
    }),
    prisma.encounters.count({
      where: { clinic_id: tenant.clinicId, patient_id: patientId },
    }),
    (async (): Promise<string | null> => {
      const authUserId = patient.profiles?.auth_user_id;
      if (!authUserId) return null;
      try {
        const supabaseAdmin = createSupabaseServerClient();
        const { data } = await supabaseAdmin.auth.admin.getUserById(authUserId);
        return data.user?.last_sign_in_at ?? null;
      } catch {
        return null;
      }
    })(),
  ]);

  return {
    patient: {
      id: patient.id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email,
      phone: patient.phone,
      gender: patient.gender,
      date_of_birth: patient.date_of_birth
        ? patient.date_of_birth.toISOString()
        : null,
      address: patient.address,
      created_at: patient.created_at.toISOString(),
      profile_id: patient.profile_id,
    },
    portal: {
      hasAccount: Boolean(patient.profile_id),
      email: patient.profiles?.email ?? patient.email ?? null,
      status: patient.profiles?.status ?? null,
      lastSignInAt,
    },
    counts: {
      appointments: appointmentsCount,
      encounters: encountersCount,
    },
    recentAppointments: appointments.map((a) => ({
      id: a.id,
      appointment_date: a.appointment_date.toISOString(),
      status: String(a.status),
      notes: a.notes,
      doctorName: a.profiles?.full_name ?? null,
    })),
    recentEncounters: encounters.map((e) => ({
      id: e.id,
      encounter_date: e.encounter_date.toISOString(),
      encounter_type: e.encounter_type,
      diagnosis: e.diagnosis,
      notes: e.notes,
      doctorName: e.profiles?.full_name ?? null,
    })),
  };
}

/**
 * Generate a new temporary portal password for an existing patient account.
 * Restricted server-side to clinic owners and doctors.
 */
export async function resetPatientPassword(
  patientId: string,
): Promise<{ success: true; tempPassword: string } | { error: string }> {
  try {
    const tenant = await requirePatientPasswordManager();

    const patient = await prisma.patients.findFirst({
      where: { id: patientId, clinic_id: tenant.clinicId },
      include: {
        profiles: {
          select: { id: true, auth_user_id: true },
        },
      },
    });

    if (!patient) {
      return { error: "Patient not found." };
    }
    if (!patient.profile_id || !patient.profiles?.auth_user_id) {
      return { error: "This patient does not have a portal account yet." };
    }

    const tempPassword = generateTempPassword();
    const supabaseAdmin = createSupabaseServerClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      patient.profiles.auth_user_id,
      { password: tempPassword },
    );

    if (error) {
      return { error: error.message || "Failed to reset password." };
    }

    return { success: true, tempPassword };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Set a custom portal password for an existing patient account.
 * Restricted server-side to clinic owners and doctors.
 */
export async function setPatientPassword(
  patientId: string,
  input: SetPatientPasswordInput,
): Promise<{ success: true } | { error: string }> {
  try {
    const tenant = await requirePatientPasswordManager();

    const parsed = setPatientPasswordSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid password.",
      };
    }

    const patient = await prisma.patients.findFirst({
      where: { id: patientId, clinic_id: tenant.clinicId },
      include: {
        profiles: {
          select: { id: true, auth_user_id: true },
        },
      },
    });

    if (!patient) {
      return { error: "Patient not found." };
    }
    if (!patient.profile_id || !patient.profiles?.auth_user_id) {
      return { error: "This patient does not have a portal account yet." };
    }

    const supabaseAdmin = createSupabaseServerClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      patient.profiles.auth_user_id,
      { password: parsed.data.password },
    );

    if (error) {
      return { error: error.message || "Failed to update password." };
    }

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
