import { z } from "zod";

export const prescriptionStatusEnum = z.enum([
  "active",
  "completed",
  "cancelled",
]);

export const prescriptionItemSchema = z.object({
  medication_id: z.string().uuid().nullable().optional(),
  medication_name: z.string().min(1, "Medication is required"),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  route: z.string().optional(),
  // Empty string from the number input coerces to undefined (not 0) so an
  // omitted quantity passes .optional() instead of failing .positive().
  quantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  instructions: z.string().optional(),
});

export const prescriptionFormSchema = z.object({
  patient_id: z.string().uuid("Please select a patient"),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  status: prescriptionStatusEnum.default("active"),
  items: z
    .array(prescriptionItemSchema)
    .min(1, "Add at least one medication"),
});

export type PrescriptionStatus = z.infer<typeof prescriptionStatusEnum>;
export type PrescriptionItemData = z.infer<typeof prescriptionItemSchema>;
export type PrescriptionFormData = z.infer<typeof prescriptionFormSchema>;
