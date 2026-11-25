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

export const MEDICINE_CATEGORIES = [
  "antibiotic",
  "analgesic",
  "antihypertensive",
  "antidiabetic",
  "antihistamine",
  "gastrointestinal",
  "respiratory",
  "cardiovascular",
  "dermatological",
  "vitamins_supplements",
  "other",
] as const;

export type MedicineCategory = (typeof MEDICINE_CATEGORIES)[number];

export const MEDICINE_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Cream",
  "Ointment",
  "Drops",
  "Inhaler",
  "Suppository",
  "Patch",
  "Powder",
  "Solution",
] as const;

export const MEDICINE_ROUTES = [
  "Oral",
  "IV",
  "IM",
  "SC",
  "Topical",
  "Inhalation",
  "Ophthalmic",
  "Otic",
  "Nasal",
  "Rectal",
  "Sublingual",
] as const;

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .nullable();

/**
 * Clinic-level medicine schema used by doctors and clinic owners.
 * `clinic_id` is always injected server-side from tenant context.
 */
export const clinicMedicineSchema = z.object({
  generic_name: z.string().trim().min(1, "Generic name is required"),
  brand_name: optionalTrimmedString,
  category: optionalTrimmedString,
  strength: optionalTrimmedString,
  form: optionalTrimmedString,
  route: optionalTrimmedString,
  default_dosage: optionalTrimmedString,
  default_frequency: optionalTrimmedString,
  default_duration: optionalTrimmedString,
  default_quantity: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      z.coerce
        .number()
        .int("Quantity must be a whole number")
        .positive("Quantity must be positive")
        .nullable(),
    )
    .optional(),
  default_instructions: optionalTrimmedString,
  manufacturer: optionalTrimmedString,
  price: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      z.coerce.number().nonnegative("Price must be positive").nullable(),
    )
    .optional(),
  barcode: optionalTrimmedString,
  code: optionalTrimmedString,
  code_system: optionalTrimmedString,
});

export type ClinicMedicineFormData = z.input<typeof clinicMedicineSchema>;
export type ClinicMedicineData = z.output<typeof clinicMedicineSchema>;

export const stopMedicineSchema = z.object({
  id: z.string().uuid("Invalid medicine id"),
  stop_reason: z.string().trim().max(500).optional().nullable(),
});

export type StopMedicineInput = z.infer<typeof stopMedicineSchema>;

export interface CatalogMedicineOption {
  id: string;
  generic_name: string;
  brand_name: string | null;
  category: string | null;
  strength: string | null;
  form: string | null;
  route: string | null;
  default_dosage: string | null;
  default_frequency: string | null;
  default_duration: string | null;
  default_quantity: number | null;
  default_instructions: string | null;
}

export interface ClinicMedicineRecord extends CatalogMedicineOption {
  clinic_id: string;
  manufacturer: string | null;
  barcode: string | null;
  code: string | null;
  code_system: string | null;
  price: number | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  stopped_at: string | Date | null;
  stopped_by: string | null;
  stop_reason: string | null;
  created_by_name: string | null;
  stopped_by_name: string | null;
}

export interface ClinicMedicineCounts {
  total: number;
  active: number;
  stopped: number;
}

/** Format a catalog row into a human-readable medication label. */
export function formatMedicineLabel(
  med: Pick<CatalogMedicineOption, "generic_name" | "brand_name" | "strength">,
): string {
  const base = med.brand_name
    ? `${med.brand_name} (${med.generic_name})`
    : med.generic_name;
  return med.strength ? `${base} ${med.strength}` : base;
}

/** Build prescription item values from a catalog medicine's prescribing defaults. */
export function buildPrescriptionDefaultsFromMedicine(
  med: CatalogMedicineOption,
): {
  medication_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number | undefined;
  instructions: string;
} {
  return {
    medication_id: med.id,
    medication_name: formatMedicineLabel(med),
    dosage: med.default_dosage || med.strength || "",
    frequency: med.default_frequency || "",
    duration: med.default_duration || "",
    route: med.route || "",
    quantity: med.default_quantity ?? undefined,
    instructions: med.default_instructions || "",
  };
}
