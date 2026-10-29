"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import {
  computeCategoryDeductions,
  isPolicyEligible,
  remainingVisits,
  type ProviderDeductionRules,
} from "@/lib/insurance";
import {
  assertSessionConnected,
  sendTextToPhone,
} from "@/lib/whatsapp/waha-client";
import {
  billingCatalogItemSchema,
  updateInvoiceItemsSchema,
  type BillingCatalogItemData,
  type BillingCatalogItemRow,
  type BillingItemCategory,
  type InvoiceDeliveryResult,
  type InvoiceDetails,
  type UpdateInvoiceItemsData,
} from "@/types/billing.types";
import {
  createInvoiceSchema,
  type CreateInvoiceData,
  type CreateInvoiceResult,
  type DeductionPreview,
  type DeductionPreviewLineInput,
} from "@/types/insurance.types";

/** Roles allowed to manage catalog items, issue invoices, and edit invoice items. */
const BILLING_ROLES = ["owner", "admin", "super_admin", "doctor"] as const;

async function requireBillingRole() {
  const tenant = await requireTenantInfo();
  if (!(BILLING_ROLES as readonly string[]).includes(tenant.role)) {
    throw new Error(
      "Unauthorized: billing is restricted to owners, admins, super admins, and doctors",
    );
  }
  return tenant;
}

function revalidateBillingPages() {
  revalidatePath("/admin/billing");
  revalidatePath("/doctor/billing");
  revalidatePath("/staff/billing");
}

type PolicyWithProvider = {
  id: string;
  policy_number: string | null;
  is_active: boolean;
  valid_from: Date | null;
  valid_to: Date | null;
  visits_used: number;
  insurance_providers: {
    name: string;
    deduction_type: "fixed" | "percentage";
    deduction_value: unknown;
    consultation_deduction_type?: "fixed" | "percentage" | null;
    consultation_deduction_value?: unknown;
    lab_deduction_type?: "fixed" | "percentage" | null;
    lab_deduction_value?: unknown;
    pharmacy_deduction_type?: "fixed" | "percentage" | null;
    pharmacy_deduction_value?: unknown;
    covered_visits: number | null;
    is_active: boolean;
    deleted_at: Date | null;
  };
};

function toProviderDeductionRules(
  provider: PolicyWithProvider["insurance_providers"],
): ProviderDeductionRules {
  return {
    deduction_type: provider.deduction_type,
    deduction_value: Number(provider.deduction_value) || 0,
    consultation_deduction_type: provider.consultation_deduction_type ?? null,
    consultation_deduction_value:
      provider.consultation_deduction_value !== null &&
      provider.consultation_deduction_value !== undefined
        ? Number(provider.consultation_deduction_value)
        : null,
    lab_deduction_type: provider.lab_deduction_type ?? null,
    lab_deduction_value:
      provider.lab_deduction_value !== null &&
      provider.lab_deduction_value !== undefined
        ? Number(provider.lab_deduction_value)
        : null,
    pharmacy_deduction_type: provider.pharmacy_deduction_type ?? null,
    pharmacy_deduction_value:
      provider.pharmacy_deduction_value !== null &&
      provider.pharmacy_deduction_value !== undefined
        ? Number(provider.pharmacy_deduction_value)
        : null,
  };
}

/**
 * The policy billing will use for a patient: the explicitly requested one, or
 * the first eligible policy (active provider + validity window + visits left).
 */
async function findEligiblePolicy(
  db: Pick<typeof prisma, "patient_insurances">,
  clinicId: string,
  patientId: string,
  policyId?: string,
  allowCurrentVisitUsage: boolean = false,
): Promise<PolicyWithProvider | null> {
  const policies = await db.patient_insurances.findMany({
    where: {
      clinic_id: clinicId,
      patient_id: patientId,
      deleted_at: null,
      ...(policyId ? { id: policyId } : {}),
    },
    include: { insurance_providers: true },
    orderBy: { created_at: "asc" },
  });

  return (
    policies.find((policy) =>
      isPolicyEligible({
        is_active: policy.is_active,
        valid_from: policy.valid_from,
        valid_to: policy.valid_to,
        visits_used: allowCurrentVisitUsage
          ? Math.max(0, policy.visits_used - 1)
          : policy.visits_used,
        provider: {
          is_active:
            policy.insurance_providers.is_active &&
            policy.insurance_providers.deleted_at === null,
          covered_visits: policy.insurance_providers.covered_visits,
        },
      }),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Billing / Prescription Item Catalog CRUD
// ---------------------------------------------------------------------------

export async function getBillingCatalogItems(options?: {
  activeOnly?: boolean;
}): Promise<BillingCatalogItemRow[]> {
  const tenant = await requireBillingRole();

  const rows = await prisma.billing_catalog_items.findMany({
    where: {
      clinic_id: tenant.clinicId,
      deleted_at: null,
      ...(options?.activeOnly ? { is_active: true } : {}),
    },
    orderBy: [{ category: "asc" }, { name_en: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    name_en: row.name_en,
    name_ar: row.name_ar,
    category: row.category as BillingItemCategory,
    price: Number(row.price),
    description: row.description,
    is_active: row.is_active,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }));
}

export async function createBillingCatalogItem(data: BillingCatalogItemData) {
  try {
    const tenant = await requireBillingRole();
    const parsed = billingCatalogItemSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid item data." };
    }

    const created = await prisma.billing_catalog_items.create({
      data: {
        id: randomUUID(),
        clinic_id: tenant.clinicId,
        name_en: parsed.data.name_en,
        name_ar: parsed.data.name_ar,
        category: parsed.data.category,
        price: parsed.data.price,
        description: parsed.data.description || null,
        is_active: parsed.data.is_active,
        created_by: tenant.profileId,
      },
    });

    revalidateBillingPages();
    return { success: true as const, id: created.id };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to create catalog item.",
    };
  }
}

export async function updateBillingCatalogItem(
  id: string,
  data: BillingCatalogItemData,
) {
  try {
    const tenant = await requireBillingRole();
    const parsed = billingCatalogItemSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid item data." };
    }

    const { count } = await prisma.billing_catalog_items.updateMany({
      where: { id, clinic_id: tenant.clinicId, deleted_at: null },
      data: {
        name_en: parsed.data.name_en,
        name_ar: parsed.data.name_ar,
        category: parsed.data.category,
        price: parsed.data.price,
        description: parsed.data.description || null,
        is_active: parsed.data.is_active,
        updated_at: new Date(),
      },
    });

    if (count === 0) return { error: "Catalog item not found." };

    revalidateBillingPages();
    return { success: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to update catalog item.",
    };
  }
}

export async function toggleBillingCatalogItemStatus(
  id: string,
  isActive: boolean,
) {
  try {
    const tenant = await requireBillingRole();

    const { count } = await prisma.billing_catalog_items.updateMany({
      where: { id, clinic_id: tenant.clinicId, deleted_at: null },
      data: { is_active: isActive, updated_at: new Date() },
    });

    if (count === 0) return { error: "Catalog item not found." };

    revalidateBillingPages();
    return { success: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to update item status.",
    };
  }
}

// ---------------------------------------------------------------------------
// Insurance Deduction Preview
// ---------------------------------------------------------------------------

/**
 * What insurance would deduct from a gross amount or categorized items for this
 * patient — used by the create/edit invoice dialogs for a live preview.
 */
export async function getInsuranceDeductionPreview(
  patientId: string,
  grossOrItems: number | DeductionPreviewLineInput[],
  policyId?: string,
  itemsArg?: DeductionPreviewLineInput[],
): Promise<DeductionPreview> {
  const tenant = await requireBillingRole();

  const items: DeductionPreviewLineInput[] = Array.isArray(grossOrItems)
    ? grossOrItems
    : itemsArg && itemsArg.length > 0
      ? itemsArg
      : [{ category: "other", quantity: 1, unit_price: grossOrItems }];

  const policy = await findEligiblePolicy(
    prisma,
    tenant.clinicId,
    patientId,
    policyId,
  );
  if (!policy) return null;

  const provider = policy.insurance_providers;
  const rules = toProviderDeductionRules(provider);
  const computed = computeCategoryDeductions(rules, items);
  if (computed.gross <= 0) return null;

  return {
    patient_insurance_id: policy.id,
    provider_name: provider.name,
    deduction_type: rules.deduction_type,
    deduction_value: rules.deduction_value,
    remaining_visits: remainingVisits(
      provider.covered_visits,
      policy.visits_used,
    ),
    gross: computed.gross,
    deduction: computed.deduction,
    net: computed.net,
    breakdown: computed.breakdown,
  };
}

// ---------------------------------------------------------------------------
// Invoice Creation & Editing (Invoices are never deleted)
// ---------------------------------------------------------------------------

/**
 * Create an invoice with line items; when insurance applies, atomically record
 * the insurer's share as a submitted claim (with category-aware deduction) and
 * consume one covered visit.
 */
export async function createInvoice(
  data: CreateInvoiceData,
): Promise<CreateInvoiceResult> {
  try {
    const tenant = await requireBillingRole();

    const result = createInvoiceSchema.safeParse(data);
    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? "Invalid input." };
    }
    const parsed = result.data;

    const patient = await prisma.patients.findFirst({
      where: { id: parsed.patient_id, clinic_id: tenant.clinicId },
      select: { id: true },
    });
    if (!patient) return { error: "Patient not found." };

    const gross = round2(
      parsed.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      ),
    );
    if (gross <= 0) {
      return { error: "Invoice total must be greater than zero." };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const invoiceId = randomUUID();

      await tx.invoices.create({
        data: {
          id: invoiceId,
          clinic_id: tenant.clinicId,
          branch_id: tenant.branchId ?? null,
          patient_id: parsed.patient_id,
          invoice_type: parsed.invoice_type || "visit",
          invoice_number: `INV-${invoiceId.slice(0, 8).toUpperCase()}`,
          total_amount: gross,
          status: "issued",
        },
      });

      await tx.invoice_items.createMany({
        data: parsed.items.map((item) => ({
          id: randomUUID(),
          invoice_id: invoiceId,
          clinic_id: tenant.clinicId,
          catalog_item_id: item.catalog_item_id || null,
          category: item.category ?? "other",
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: round2(item.quantity * item.unit_price),
        })),
      });

      let deduction = 0;
      if (parsed.apply_insurance) {
        const policy = await findEligiblePolicy(
          tx,
          tenant.clinicId,
          parsed.patient_id,
          parsed.patient_insurance_id,
        );

        if (policy) {
          const rules = toProviderDeductionRules(policy.insurance_providers);
          const computed = computeCategoryDeductions(
            rules,
            parsed.items.map((it) => ({
              category: it.category ?? "other",
              quantity: it.quantity,
              unit_price: it.unit_price,
            })),
          );
          deduction = computed.deduction;

          if (deduction > 0) {
            await tx.insurance_claims.create({
              data: {
                id: randomUUID(),
                clinic_id: tenant.clinicId,
                patient_id: parsed.patient_id,
                insurance_id: policy.id,
                invoice_id: invoiceId,
                claim_amount: deduction,
                status: "submitted",
              },
            });
            await tx.patient_insurances.update({
              where: { id: policy.id },
              data: { visits_used: { increment: 1 } },
            });
          }
        }
      }

      return { invoiceId, deduction };
    });

    revalidateBillingPages();

    return {
      success: true,
      invoice_id: outcome.invoiceId,
      gross,
      deduction: outcome.deduction,
      net: round2(gross - outcome.deduction),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to create invoice.",
    };
  }
}

/**
 * Edit an existing invoice's line items. Invoices cannot be deleted; only
 * `draft` and `issued` invoices can have their items modified. Atomically
 * recalculates `total_amount` and any linked `insurance_claims.claim_amount`.
 */
export async function updateInvoiceItems(
  data: UpdateInvoiceItemsData,
): Promise<CreateInvoiceResult> {
  try {
    const tenant = await requireBillingRole();

    const parsedResult = updateInvoiceItemsSchema.safeParse(data);
    if (!parsedResult.success) {
      return {
        error: parsedResult.error.issues[0]?.message ?? "Invalid input.",
      };
    }
    const parsed = parsedResult.data;

    const existing = await prisma.invoices.findFirst({
      where: { id: parsed.invoice_id, clinic_id: tenant.clinicId },
      include: {
        insurance_claims: true,
      },
    });
    if (!existing) {
      return { error: "Invoice not found." };
    }
    if (existing.status === "paid" || existing.status === "cancelled") {
      return {
        error: `Cannot edit items on a ${existing.status} invoice.`,
      };
    }

    const gross = round2(
      parsed.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      ),
    );
    if (gross <= 0) {
      return { error: "Invoice total must be greater than zero." };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      // Remove existing line items and insert the updated list
      await tx.invoice_items.deleteMany({
        where: { invoice_id: existing.id, clinic_id: tenant.clinicId },
      });

      await tx.invoice_items.createMany({
        data: parsed.items.map((item) => ({
          id: randomUUID(),
          invoice_id: existing.id,
          clinic_id: tenant.clinicId,
          catalog_item_id: item.catalog_item_id || null,
          category: item.category ?? "other",
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: round2(item.quantity * item.unit_price),
        })),
      });

      await tx.invoices.update({
        where: { id: existing.id },
        data: {
          total_amount: gross,
          updated_at: new Date(),
        },
      });

      let deduction = 0;
      const existingClaim = existing.insurance_claims[0] ?? null;

      if (parsed.apply_insurance && existing.patient_id) {
        const policy = await findEligiblePolicy(
          tx,
          tenant.clinicId,
          existing.patient_id,
          existingClaim?.insurance_id ?? undefined,
          Boolean(existingClaim),
        );

        if (policy) {
          const rules = toProviderDeductionRules(policy.insurance_providers);
          const computed = computeCategoryDeductions(
            rules,
            parsed.items.map((it) => ({
              category: it.category ?? "other",
              quantity: it.quantity,
              unit_price: it.unit_price,
            })),
          );
          deduction = computed.deduction;

          if (existingClaim) {
            await tx.insurance_claims.update({
              where: { id: existingClaim.id },
              data: { claim_amount: deduction },
            });
          } else if (deduction > 0) {
            await tx.insurance_claims.create({
              data: {
                id: randomUUID(),
                clinic_id: tenant.clinicId,
                patient_id: existing.patient_id,
                insurance_id: policy.id,
                invoice_id: existing.id,
                claim_amount: deduction,
                status: "submitted",
              },
            });
            await tx.patient_insurances.update({
              where: { id: policy.id },
              data: { visits_used: { increment: 1 } },
            });
          }
        }
      } else if (!parsed.apply_insurance && existingClaim) {
        await tx.insurance_claims.update({
          where: { id: existingClaim.id },
          data: { claim_amount: 0 },
        });
      }

      return { deduction };
    });

    revalidateBillingPages();

    return {
      success: true,
      invoice_id: existing.id,
      gross,
      deduction: outcome.deduction,
      net: round2(gross - outcome.deduction),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to update invoice items.",
    };
  }
}

/**
 * Fetch complete invoice details for editing, PDF printing, WhatsApp, or Email.
 */
export async function getInvoiceDetails(
  invoiceId: string,
): Promise<InvoiceDetails | null> {
  const tenant = await requireTenantInfo();

  const invoice = await prisma.invoices.findFirst({
    where: { id: invoiceId, clinic_id: tenant.clinicId },
    include: {
      clinics: { select: { name: true, email: true, phone: true } },
      patients: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true,
          email: true,
          address: true,
        },
      },
      invoice_items: {
        where: { deleted_at: null },
        orderBy: { updated_at: "asc" },
      },
      payments: {
        where: { deleted_at: null },
      },
      insurance_claims: {
        include: {
          patient_insurances: {
            include: {
              insurance_providers: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!invoice) return null;

  const gross = round2(Number(invoice.total_amount || 0));
  const deduction = round2(
    invoice.insurance_claims.reduce(
      (sum, claim) => sum + Number(claim.claim_amount || 0),
      0,
    ),
  );
  const net = round2(Math.max(0, gross - deduction));
  const paid = round2(
    invoice.payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  );

  const firstClaim = invoice.insurance_claims[0];

  return {
    id: invoice.id,
    invoice_number:
      invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
    invoice_type: invoice.invoice_type || "visit",
    status: invoice.status,
    total_amount: gross,
    insurance_deduction: deduction,
    net_amount: net,
    paid_amount: paid,
    created_at: invoice.created_at.toISOString(),
    clinic: {
      name: invoice.clinics.name,
      email: invoice.clinics.email,
      phone: invoice.clinics.phone,
    },
    patient: invoice.patients
      ? {
          id: invoice.patients.id,
          first_name: invoice.patients.first_name,
          last_name: invoice.patients.last_name,
          phone: invoice.patients.phone,
          email: invoice.patients.email,
          address: invoice.patients.address,
        }
      : null,
    insurance_provider_name:
      firstClaim?.patient_insurances?.insurance_providers?.name ?? null,
    policy_number: firstClaim?.patient_insurances?.policy_number ?? null,
    items: invoice.invoice_items.map((item) => ({
      id: item.id,
      catalog_item_id: item.catalog_item_id ?? null,
      category: (item.category as BillingItemCategory) ?? "other",
      description: item.description || "",
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// Multi-Channel Invoice Delivery (WhatsApp & Email)
// ---------------------------------------------------------------------------

function formatInvoiceTextMessage(
  details: InvoiceDetails,
  locale: string = "en",
): string {
  const isAr = locale === "ar";
  const patientName = details.patient
    ? `${details.patient.first_name || ""} ${details.patient.last_name || ""}`.trim()
    : isAr
      ? "مريض"
      : "Patient";
  const dateStr = new Date(details.created_at).toLocaleDateString(
    isAr ? "ar-EG" : "en-US",
  );

  const itemLines = details.items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.description} (${item.quantity} × $${item.unit_price.toFixed(2)}) = $${item.total_price.toFixed(2)}`,
    )
    .join("\n");

  if (isAr) {
    return [
      `*${details.clinic.name}*`,
      `فاتورة رقم: ${details.invoice_number}`,
      `التاريخ: ${dateStr}`,
      `المريض: ${patientName}`,
      `---`,
      `*البنود:*`,
      itemLines,
      `---`,
      `الإجمالي: $${details.total_amount.toFixed(2)}`,
      ...(details.insurance_deduction > 0
        ? [
            `خصم التأمين${details.insurance_provider_name ? ` (${details.insurance_provider_name})` : ""}: -$${details.insurance_deduction.toFixed(2)}`,
          ]
        : []),
      `*المبلغ المطلوب دفعه: $${details.net_amount.toFixed(2)}*`,
    ].join("\n");
  }

  return [
    `*${details.clinic.name}*`,
    `Invoice #: ${details.invoice_number}`,
    `Date: ${dateStr}`,
    `Patient: ${patientName}`,
    `---`,
    `*Items:*`,
    itemLines,
    `---`,
    `Gross Total: $${details.total_amount.toFixed(2)}`,
    ...(details.insurance_deduction > 0
      ? [
          `Insurance Deduction${details.insurance_provider_name ? ` (${details.insurance_provider_name})` : ""}: -$${details.insurance_deduction.toFixed(2)}`,
        ]
      : []),
    `*Net Payable: $${details.net_amount.toFixed(2)}*`,
  ].join("\n");
}

/**
 * Send an invoice receipt to the patient's WhatsApp number.
 * Uses the configured WAHA gateway when online and logs to `whatsapp_messages`;
 * falls back to a `https://wa.me/<digits>?text=...` deep link when WAHA is not
 * connected so the user can always complete the send.
 */
export async function sendInvoiceWhatsApp(
  invoiceId: string,
  locale: string = "en",
): Promise<InvoiceDeliveryResult> {
  try {
    const tenant = await requireBillingRole();
    const details = await getInvoiceDetails(invoiceId);
    if (!details) return { error: "Invoice not found." };

    const rawPhone = details.patient?.phone?.trim();
    if (!rawPhone) {
      return { error: "Patient does not have a phone number on file." };
    }

    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 8) {
      return { error: "Patient phone number is invalid for WhatsApp." };
    }

    const text = formatInvoiceTextMessage(details, locale);
    const fallbackUrl = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;

    try {
      await assertSessionConnected();
      const sent = await sendTextToPhone({ phone: rawPhone, text });
      await prisma.whatsapp_messages.create({
        data: {
          tenant_id: tenant.clinicId,
          group_id: randomUUID(),
          sender_id: tenant.profileId,
          sender_role: tenant.role,
          recipient_kind: "patient",
          recipient_id: details.patient?.id ?? null,
          recipient_role: "patient",
          to_phone: rawPhone,
          body: text,
          status: "sent",
          waha_message_id: sent.id,
          created_by: tenant.profileId,
        },
      });
      return {
        success: true,
        mode: "gateway",
        message: "Invoice sent via WhatsApp.",
      };
    } catch {
      return {
        success: true,
        mode: "fallback",
        fallbackUrl,
        message: "Opening WhatsApp with the invoice details.",
      };
    }
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to send invoice via WhatsApp.",
    };
  }
}

/**
 * Send an invoice receipt to the patient's email address.
 * Uses Resend API if `RESEND_API_KEY` is configured; otherwise returns a
 * pre-populated `mailto:` link fallback.
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  locale: string = "en",
): Promise<InvoiceDeliveryResult> {
  try {
    await requireBillingRole();
    const details = await getInvoiceDetails(invoiceId);
    if (!details) return { error: "Invoice not found." };

    const email = details.patient?.email?.trim();
    if (!email) {
      return { error: "Patient does not have an email address on file." };
    }

    const isAr = locale === "ar";
    const subject = isAr
      ? `فاتورة ${details.invoice_number} - ${details.clinic.name}`
      : `Invoice ${details.invoice_number} from ${details.clinic.name}`;
    const plainBody = formatInvoiceTextMessage(details, locale).replace(
      /\*/g,
      "",
    );
    const fallbackUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.EMAIL_FROM || "billing@notifications.clinic.app";

    if (resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject,
          text: plainBody,
        }),
      });

      if (response.ok) {
        return {
          success: true,
          mode: "gateway",
          message: `Invoice emailed to ${email}.`,
        };
      }
    }

    return {
      success: true,
      mode: "fallback",
      fallbackUrl,
      message: "Opening your email client with the invoice details.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to send invoice via email.",
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
