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
