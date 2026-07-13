import { z } from "zod";

/**
 * Medication catalog entry. Clinic-scoped: every medication belongs to a
 * single clinic (`clinic_id`) and is unique per `[clinic_id, generic_name,
 * strength]`. Managed by the app-owner on behalf of a selected clinic.
 */
export const medicationSchema = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid("Clinic is required"),
  generic_name: z.string().min(1, "Generic name is required"),
  brand_name: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  form: z.string().optional().nullable(),
  route: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  code_system: z.string().optional().nullable(),
  price: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.number().nonnegative("Price must be positive").nullable(),
  ),
  is_active: z.boolean().default(true),
});

/** Pre-parse shape (form values before Zod coercion/defaults). */
export type MedicationFormData = z.input<typeof medicationSchema>;

/** Post-parse shape (validated server-side data). */
export type MedicationData = z.output<typeof medicationSchema>;

/** Lightweight clinic option used by the owner's clinic selector. */
export interface ClinicOption {
  id: string;
  name: string;
}
