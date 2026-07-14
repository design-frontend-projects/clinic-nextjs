import { prisma } from "@/lib/prisma";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import { findClinicDuplicate, duplicateMessage } from "@/lib/user-creation";
import {
  createAppointmentWithPatientSchema,
  type CreateAppointmentWithPatientData,
} from "@/types/appointment.types";

/**
 * Permission-agnostic appointment write helpers shared by the admin and staff
 * server actions. Callers are responsible for resolving the tenant and enforcing
 * the appropriate RBAC permission (`appointment.manage` for admin,
 * `appointment.create` for front-desk staff) BEFORE invoking these functions and
 * for calling `revalidatePath` on their own routes afterwards.
 */

export interface AppointmentScope {
  clinicId: string;
  branchId: string | null;
}

export interface CreateAppointmentInput {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  notes?: string;
}

export type RegisterPatientResult =
  | { success: true; tempPassword: string }
  | { error: string };

/**
 * Create a `scheduled` appointment for an existing patient.
 */
export async function createAppointmentForScope(
  scope: AppointmentScope,
  data: CreateAppointmentInput,
) {
  const appointmentDate = new Date(data.appointment_date);

  return prisma.appointments.create({
    data: {
      clinic_id: scope.clinicId,
      branch_id: scope.branchId,
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      appointment_date: appointmentDate,
      notes: data.notes || null,
      status: "scheduled",
    },
  });
}

/**
 * Register a brand-new patient (auth user + profile + patient record) and book
 * their appointment in a single transaction. Rolls back the auth user if the DB
 * write fails. Returns a discriminated result object rather than throwing so the
 * caller can surface `{ error }` inline in the dialog.
 */
export async function registerPatientWithAppointmentForScope(
  scope: AppointmentScope,
  data: CreateAppointmentWithPatientData,
): Promise<RegisterPatientResult> {
  const parsed = createAppointmentWithPatientSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid data" };
  }

  const patientData = parsed.data.patient;
  const appointmentData = parsed.data.appointment;

  // Block duplicates within the clinic (by email or phone).
  const duplicate = await findClinicDuplicate({
    clinicId: scope.clinicId,
    email: patientData.email,
    phone: patientData.phone,
  });
  if (duplicate) {
    return { error: duplicateMessage(duplicate) };
  }

  // Create the patient's confirmed auth user with a temp password.
  let account;
  try {
    account = await createUserAccount({
      email: patientData.email,
      metadata: {
        full_name: `${patientData.first_name} ${patientData.last_name}`.trim(),
        role: "patient",
        tenant_id: scope.clinicId,
      },
    });
  } catch (inviteError) {
    const message =
      inviteError instanceof Error
        ? inviteError.message
        : "Failed to create patient account";
    return { error: message };
  }

  // Insert new profile, patient, and appointment in a transaction.
  try {
    await prisma.$transaction(async (tx) => {
      const fullName =
        `${patientData.first_name} ${patientData.last_name}`.trim();

      // 1. Upsert profile (trigger pre-creates the row on auth-user insert).
      const profile = await tx.profiles.upsert({
        where: { auth_user_id: account.user.id },
        update: {
          tenant_id: scope.clinicId,
          full_name: fullName,
          email: patientData.email,
          phone: patientData.phone ?? null,
          role: "patient",
          status: "active",
          is_owner: false,
          is_profile_completed: false,
        },
        create: {
          auth_user_id: account.user.id,
          tenant_id: scope.clinicId,
          full_name: fullName,
          email: patientData.email,
          phone: patientData.phone ?? null,
          role: "patient",
          status: "active",
          is_owner: false,
          is_profile_completed: false,
        },
      });

      // 2. Create the patient record.
      const patient = await tx.patients.create({
        data: {
          clinic_id: scope.clinicId,
          branch_id: scope.branchId,
          profile_id: profile.id,
          first_name: patientData.first_name,
          last_name: patientData.last_name,
          email: patientData.email,
          phone: patientData.phone ?? null,
          gender: patientData.gender as
            | "male"
            | "female"
            | "other"
            | undefined,
          date_of_birth: patientData.date_of_birth
            ? new Date(patientData.date_of_birth)
            : null,
          address: patientData.address ?? null,
        },
      });

      // 3. Create the appointment.
      await tx.appointments.create({
        data: {
          clinic_id: scope.clinicId,
          branch_id: scope.branchId,
          patient_id: patient.id,
          doctor_id: appointmentData.doctor_id,
          appointment_date: new Date(appointmentData.appointment_date),
          notes: appointmentData.notes ?? null,
          status: appointmentData.status,
        },
      });
    });
  } catch {
    // Rollback the auth user if any DB operation fails.
    await rollbackAuthUser(account.user.id);
    return { error: "Failed to save patient records. Process rolled back." };
  }

  return { success: true, tempPassword: account.tempPassword };
}
