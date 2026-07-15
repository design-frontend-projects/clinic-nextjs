"use server";

import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { computeDeduction, isPolicyEligible, remainingVisits } from "@/lib/insurance";
import {
  createInvoiceSchema,
  type CreateInvoiceData,
  type CreateInvoiceResult,
  type DeductionPreview,
} from "@/types/insurance.types";
import { revalidatePath } from "next/cache";

/** Roles allowed to issue invoices (owner/admin dashboards + practicing doctors). */
const BILLING_ROLES = ["owner", "admin", "doctor"] as const;

async function requireBillingRole() {
  const tenant = await requireTenantInfo();
  if (!(BILLING_ROLES as readonly string[]).includes(tenant.role)) {
    throw new Error("Unauthorized: billing is restricted to owners and doctors");
  }
  return tenant;
}

type PolicyWithProvider = {
  id: string;
  is_active: boolean;
  valid_from: Date | null;
  valid_to: Date | null;
  visits_used: number;
  insurance_providers: {
    name: string;
    deduction_type: "fixed" | "percentage";
    deduction_value: unknown;
    covered_visits: number | null;
    is_active: boolean;
    deleted_at: Date | null;
  };
};

/**
 * The policy billing will use for a patient: the explicitly requested one, or
 * the first eligible policy (active provider + validity window + visits left).
 */
async function findEligiblePolicy(
  db: Pick<typeof prisma, "patient_insurances">,
  clinicId: string,
  patientId: string,
  policyId?: string,
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
        visits_used: policy.visits_used,
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

/**
 * What insurance would deduct from a gross amount for this patient — used by
 * the create-invoice dialog for a live preview. Returns null when the patient
 * has no eligible policy.
 */
export async function getInsuranceDeductionPreview(
  patientId: string,
  gross: number,
  policyId?: string,
): Promise<DeductionPreview> {
  const tenant = await requireBillingRole();
  if (!Number.isFinite(gross) || gross < 0) return null;

  const policy = await findEligiblePolicy(
    prisma,
    tenant.clinicId,
    patientId,
    policyId,
  );
  if (!policy) return null;

  const provider = policy.insurance_providers;
  const rule = {
    deduction_type: provider.deduction_type,
    deduction_value: Number(provider.deduction_value),
  };
  const deduction = computeDeduction(rule, gross);

  return {
    patient_insurance_id: policy.id,
    provider_name: provider.name,
    deduction_type: rule.deduction_type,
    deduction_value: rule.deduction_value,
    remaining_visits: remainingVisits(provider.covered_visits, policy.visits_used),
    gross: round2(gross),
    deduction,
    net: round2(gross - deduction),
  };
}

/**
 * Create an invoice with line items; when insurance applies, atomically record
 * the insurer's share as a submitted claim and consume one covered visit.
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
    if (gross <= 0) return { error: "Invoice total must be greater than zero." };

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
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: round2(item.quantity * item.unit_price),
        })),
      });

      let deduction = 0;
      if (parsed.apply_insurance) {
        // Re-resolve eligibility inside the transaction; the client preview
        // is advisory only.
        const policy = await findEligiblePolicy(
          tx,
          tenant.clinicId,
          parsed.patient_id,
          parsed.patient_insurance_id,
        );

        if (policy) {
          deduction = computeDeduction(
            {
              deduction_type: policy.insurance_providers.deduction_type,
              deduction_value: Number(policy.insurance_providers.deduction_value),
            },
            gross,
          );

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

    revalidatePath("/admin/billing");

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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
