import { z } from "zod";
import type { patients } from "@prisma/client";

export const patientGenderEnum = z.enum(["male", "female", "other"]);
export type PatientGender = z.infer<typeof patientGenderEnum>;

export interface PatientValidationMessages {
  firstNameRequired: string;
  lastNameRequired: string;
  emailInvalid: string;
}

/**
 * Build the patient creation Zod schema with optional localized messages.
 * Shared between client forms (`CreatePatientDialog`) and server validation
 * (`createPatient`).
 */
export function buildPatientFormSchema(
  messages?: Partial<PatientValidationMessages>,
) {
  return z.object({
    first_name: z
      .string()
      .trim()
      .min(1, messages?.firstNameRequired ?? "First name is required"),
    last_name: z
      .string()
      .trim()
      .min(1, messages?.lastNameRequired ?? "Last name is required"),
    email: z
      .string()
      .trim()
      .email(messages?.emailInvalid ?? "Please enter a valid email address")
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().optional(),
    gender: patientGenderEnum.optional(),
    date_of_birth: z.string().optional(),
    address: z.string().trim().optional(),
  });
}

export const createPatientSchema = buildPatientFormSchema();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type PatientRecord = patients;

export type CreatePatientResult =
  | { success: true; patient: PatientRecord }
  | { error: string };

export interface PatientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: Date | string | null;
  address?: string | null;
  created_at: Date | string;
  profile_id: string | null;
}

export interface PatientOverview {
  patient: PatientRow;
  portal: {
    hasAccount: boolean;
    email: string | null;
    status: string | null;
    lastSignInAt: string | null;
  };
  counts: {
    appointments: number;
    encounters: number;
  };
  recentAppointments: Array<{
    id: string;
    appointment_date: string;
    status: string;
    notes: string | null;
    doctorName: string | null;
  }>;
  recentEncounters: Array<{
    id: string;
    encounter_date: string;
    encounter_type: string | null;
    diagnosis: string | null;
    notes: string | null;
    doctorName: string | null;
  }>;
}

export interface SetPatientPasswordValidationMessages {
  minLength: string;
  maxLength: string;
  complexity: string;
  confirmRequired: string;
  mismatch: string;
}

export function buildSetPatientPasswordSchema(
  messages?: Partial<SetPatientPasswordValidationMessages>,
) {
  return z
    .object({
      password: z
        .string()
        .min(8, messages?.minLength ?? "Password must be at least 8 characters")
        .max(72, messages?.maxLength ?? "Password must be at most 72 characters")
        .refine(
          (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
          messages?.complexity ??
            "Password must contain at least one letter and one number",
        ),
      confirm: z
        .string()
        .min(1, messages?.confirmRequired ?? "Please confirm the password"),
    })
    .refine((d) => d.password === d.confirm, {
      path: ["confirm"],
      message: messages?.mismatch ?? "Passwords do not match",
    });
}

export const setPatientPasswordSchema = buildSetPatientPasswordSchema();

export type SetPatientPasswordInput = z.infer<typeof setPatientPasswordSchema>;
