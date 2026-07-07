import { z } from "zod";

export const appointmentStatusEnum = z.enum([
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]);

export const appointmentFormSchema = z.object({
  patient_id: z.string().uuid("Please select a patient"),
  doctor_id: z.string().uuid("Please select a doctor"),
  appointment_date: z.date({
    message: "Please select a date and time",
  }),
  notes: z.string().optional(),
  status: appointmentStatusEnum.default("scheduled"),
});

export const newPatientSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  date_of_birth: z.date().optional(),
  address: z.string().optional(),
});

export const createAppointmentWithPatientSchema = z.object({
  patient: newPatientSchema,
  appointment: appointmentFormSchema.omit({ patient_id: true }),
});

export type AppointmentFormData = z.infer<typeof appointmentFormSchema>;
export type NewPatientFormData = z.infer<typeof newPatientSchema>;
export type CreateAppointmentWithPatientData = z.infer<typeof createAppointmentWithPatientSchema>;
