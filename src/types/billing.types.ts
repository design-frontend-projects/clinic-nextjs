import { z } from "zod";

export const billingItemCategoryEnum = z.enum([
  "consultation",
  "lab",
  "pharmacy",
  "prescription",
  "procedure",
  "other",
]);

export type BillingItemCategory = z.infer<typeof billingItemCategoryEnum>;

export const BILLING_ITEM_CATEGORIES: readonly BillingItemCategory[] = [
  "consultation",
  "lab",
  "pharmacy",
  "prescription",
  "procedure",
  "other",
] as const;

/** Schema for creating or editing a bilingual catalog item / service / prescription type. */
export const billingCatalogItemSchema = z.object({
  name_en: z.string().trim().min(1, "English name is required").max(200),
  name_ar: z.string().trim().min(1, "Arabic name is required").max(200),
  category: billingItemCategoryEnum.default("consultation"),
  price: z.coerce.number().min(0, "Price must be zero or positive"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type BillingCatalogItemData = z.infer<typeof billingCatalogItemSchema>;

export type BillingCatalogItemRow = {
  id: string;
  clinic_id: string;
  name_en: string;
  name_ar: string;
  category: BillingItemCategory;
  price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Line item input used by both Create Invoice and Edit Invoice Items. */
export const invoiceLineItemInputSchema = z.object({
  catalog_item_id: z.string().uuid().optional().nullable(),
  category: billingItemCategoryEnum.default("other"),
  description: z.string().trim().min(1, "Item description is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Unit price cannot be negative"),
});

export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemInputSchema>;

/** Edit an existing invoice's items (invoices cannot be deleted). */
export const updateInvoiceItemsSchema = z.object({
  invoice_id: z.string().uuid("Invalid invoice ID"),
  apply_insurance: z.boolean().default(true),
  items: z.array(invoiceLineItemInputSchema).min(1, "Add at least one item"),
});

export type UpdateInvoiceItemsData = z.infer<typeof updateInvoiceItemsSchema>;

export type InvoiceDetailItem = {
  id: string;
  catalog_item_id: string | null;
  category: BillingItemCategory;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type InvoiceDetails = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  total_amount: number;
  insurance_deduction: number;
  net_amount: number;
  paid_amount: number;
  created_at: string;
  clinic: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  patient: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  insurance_provider_name: string | null;
  policy_number: string | null;
  items: InvoiceDetailItem[];
};

export type InvoiceDeliveryResult =
  | {
      success: true;
      mode: "gateway" | "fallback";
      fallbackUrl?: string;
      message?: string;
    }
  | { error: string };

