import { z } from "zod";
import {
  billingItemCategoryEnum,
  invoiceLineItemInputSchema,
  type BillingItemCategory,
} from "./billing.types";

export const deductionTypeEnum = z.enum(["fixed", "percentage"]);
export type DeductionType = z.infer<typeof deductionTypeEnum>;

/** Owner/admin/super_admin/doctor defines or edits an insurance company for the clinic. */
export const insuranceProviderSchema = z
  .object({
    name: z.string().trim().min(1, "Company name is required").max(200),
    contact_email: z.string().email().optional().or(z.literal("")),
    contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
    deduction_type: deductionTypeEnum,
    deduction_value: z.coerce.number().positive("Deduction must be positive"),
    /** Optional category-specific deduction overrides (Consultation, Lab, Pharmacy). */
    consultation_deduction_type: deductionTypeEnum.optional().nullable(),
    consultation_deduction_value: z.coerce
      .number()
      .min(0, "Deduction cannot be negative")
      .optional()
      .nullable(),
    lab_deduction_type: deductionTypeEnum.optional().nullable(),
    lab_deduction_value: z.coerce
      .number()
      .min(0, "Deduction cannot be negative")
      .optional()
      .nullable(),
    pharmacy_deduction_type: deductionTypeEnum.optional().nullable(),
    pharmacy_deduction_value: z.coerce
      .number()
      .min(0, "Deduction cannot be negative")
      .optional()
      .nullable(),
    /** Covered visits per policy; empty = unlimited. */
    covered_visits: z.coerce.number().int().positive().optional().nullable(),
    is_active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.deduction_type === "percentage" && data.deduction_value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deduction_value"],
        message: "Percentage cannot exceed 100",
      });
    }
    const categoryChecks: Array<{
      typeKey:
        | "consultation_deduction_type"
        | "lab_deduction_type"
        | "pharmacy_deduction_type";
      valueKey:
        | "consultation_deduction_value"
        | "lab_deduction_value"
        | "pharmacy_deduction_value";
    }> = [
      {
        typeKey: "consultation_deduction_type",
        valueKey: "consultation_deduction_value",
      },
      { typeKey: "lab_deduction_type", valueKey: "lab_deduction_value" },
      {
        typeKey: "pharmacy_deduction_type",
        valueKey: "pharmacy_deduction_value",
      },
    ];

    for (const check of categoryChecks) {
      const catType = data[check.typeKey] ?? data.deduction_type;
      const catVal = data[check.valueKey];
      if (
        catVal !== null &&
        catVal !== undefined &&
        catType === "percentage" &&
        catVal > 100
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [check.valueKey],
          message: "Percentage cannot exceed 100",
        });
      }
    }
  });

export type InsuranceProviderData = z.infer<typeof insuranceProviderSchema>;

/** Link a patient to an insurance company (a policy). */
export const assignPatientInsuranceSchema = z
  .object({
    patient_id: z.string().uuid(),
    provider_id: z.string().uuid("Select an insurance company"),
    policy_number: z.string().trim().max(100).optional().or(z.literal("")),
    valid_from: z.string().optional().or(z.literal("")),
    valid_to: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (
      data.valid_from &&
      data.valid_to &&
      new Date(data.valid_from) > new Date(data.valid_to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valid_to"],
        message: "End date must be after start date",
      });
    }
  });

export type AssignPatientInsuranceData = z.infer<
  typeof assignPatientInsuranceSchema
>;

/** Invoice creation with optional automatic insurance deduction. */
export const createInvoiceSchema = z.object({
  patient_id: z.string().uuid("Select a patient"),
  invoice_type: z.string().trim().max(50).optional(),
  /** Apply the patient's eligible insurance policy, if any. */
  apply_insurance: z.boolean().default(true),
  /** Explicit policy to use; defaults to the first eligible one. */
  patient_insurance_id: z.string().uuid().optional(),
  items: z
    .array(
      invoiceLineItemInputSchema.extend({
        category: billingItemCategoryEnum.default("other").optional(),
      }),
    )
    .min(1, "Add at least one item"),
});

export type CreateInvoiceData = z.infer<typeof createInvoiceSchema>;

/** Insurance company row shown in the management table. */
export type InsuranceProviderRow = {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  deduction_type: DeductionType;
  deduction_value: number;
  consultation_deduction_type: DeductionType | null;
  consultation_deduction_value: number | null;
  lab_deduction_type: DeductionType | null;
  lab_deduction_value: number | null;
  pharmacy_deduction_type: DeductionType | null;
  pharmacy_deduction_value: number | null;
  covered_visits: number | null;
  is_active: boolean;
  created_at: string;
  /** Live (non-deleted) policies referencing this company. */
  patients_count: number;
};

/** A patient's policy with the provider's rule, for patient pages. */
export type PatientInsuranceRow = {
  id: string;
  provider_id: string;
  provider_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  policy_number: string | null;
  valid_from: string | null;
  valid_to: string | null;
  deduction_type: DeductionType;
  deduction_value: number;
  consultation_deduction_type: DeductionType | null;
  consultation_deduction_value: number | null;
  lab_deduction_type: DeductionType | null;
  lab_deduction_value: number | null;
  pharmacy_deduction_type: DeductionType | null;
  pharmacy_deduction_value: number | null;
  covered_visits: number | null;
  visits_used: number;
  /** null = unlimited */
  remaining_visits: number | null;
  is_active: boolean;
  provider_is_active: boolean;
  /** Usable at billing right now (validity + activity + visits left). */
  is_eligible: boolean;
};

export type CategoryDeductionBreakdown = {
  bucket: "consultation" | "lab" | "pharmacy" | "default";
  subtotal: number;
  deduction_type: DeductionType;
  deduction_value: number;
  deduction: number;
};

export type DeductionPreviewLineInput = {
  category?: BillingItemCategory;
  quantity: number;
  unit_price: number;
};

/** What billing will deduct for a given gross amount or categorized item list. */
export type DeductionPreview = {
  patient_insurance_id: string;
  provider_name: string;
  deduction_type: DeductionType;
  deduction_value: number;
  remaining_visits: number | null;
  gross: number;
  deduction: number;
  net: number;
  breakdown?: CategoryDeductionBreakdown[];
} | null;

/** Result returned by createInvoice or updateInvoiceItems. */
export type CreateInvoiceResult =
  | {
      success: true;
      invoice_id: string;
      gross: number;
      deduction: number;
      net: number;
    }
  | { error: string };
