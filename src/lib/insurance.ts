import type {
  CategoryDeductionBreakdown,
  DeductionPreviewLineInput,
  DeductionType,
} from "@/types/insurance.types";

export interface DeductionRule {
  deduction_type: DeductionType;
  /** Fixed amount or percentage (0–100) depending on deduction_type. */
  deduction_value: number;
}

export interface ProviderDeductionRules extends DeductionRule {
  consultation_deduction_type?: DeductionType | null;
  consultation_deduction_value?: number | null;
  lab_deduction_type?: DeductionType | null;
  lab_deduction_value?: number | null;
  pharmacy_deduction_type?: DeductionType | null;
  pharmacy_deduction_value?: number | null;
}

export interface PolicyEligibilityInput {
  is_active: boolean;
  valid_from: Date | null;
  valid_to: Date | null;
  visits_used: number;
  provider: {
    is_active: boolean;
    /** null = unlimited visits */
    covered_visits: number | null;
  };
}

/**
 * Insurance share of an invoice gross. Fixed rules never exceed the gross;
 * percentage rules are rounded to 2 decimals. Non-positive gross → 0.
 */
export function computeDeduction(rule: DeductionRule, gross: number): number {
  if (gross <= 0 || rule.deduction_value <= 0) return 0;

  if (rule.deduction_type === "fixed") {
    return Math.min(round2(rule.deduction_value), round2(gross));
  }

  const pct = Math.min(rule.deduction_value, 100);
  return round2((gross * pct) / 100);
}

/**
 * Computes category-aware insurance deductions across an invoice's line items.
 *
 * - Categories (`consultation`, `lab`, `pharmacy`/`prescription`) that have an
 *   explicit category override (`*_deduction_value != null`) on the provider
 *   are evaluated in their own bucket using that category rule.
 * - Items whose category has no explicit override fall into the `default`
 *   bucket and share the provider's base `deduction_type`/`deduction_value`.
 * - Total deduction is capped at the invoice gross.
 */
export function computeCategoryDeductions(
  provider: ProviderDeductionRules,
  items: DeductionPreviewLineInput[],
): {
  gross: number;
  deduction: number;
  net: number;
  breakdown: CategoryDeductionBreakdown[];
} {
  const defaultRule: DeductionRule = {
    deduction_type: provider.deduction_type,
    deduction_value: Number(provider.deduction_value) || 0,
  };

  const hasConsultationRule =
    provider.consultation_deduction_value !== null &&
    provider.consultation_deduction_value !== undefined;
  const hasLabRule =
    provider.lab_deduction_value !== null &&
    provider.lab_deduction_value !== undefined;
  const hasPharmacyRule =
    provider.pharmacy_deduction_value !== null &&
    provider.pharmacy_deduction_value !== undefined;

  const bucketRules: Record<
    "consultation" | "lab" | "pharmacy" | "default",
    DeductionRule
  > = {
    consultation: hasConsultationRule
      ? {
          deduction_type:
            provider.consultation_deduction_type ?? provider.deduction_type,
          deduction_value: Number(provider.consultation_deduction_value) || 0,
        }
      : defaultRule,
    lab: hasLabRule
      ? {
          deduction_type:
            provider.lab_deduction_type ?? provider.deduction_type,
          deduction_value: Number(provider.lab_deduction_value) || 0,
        }
      : defaultRule,
    pharmacy: hasPharmacyRule
      ? {
          deduction_type:
            provider.pharmacy_deduction_type ?? provider.deduction_type,
          deduction_value: Number(provider.pharmacy_deduction_value) || 0,
        }
      : defaultRule,
    default: defaultRule,
  };

  const subtotals: Record<
    "consultation" | "lab" | "pharmacy" | "default",
    number
  > = {
    consultation: 0,
    lab: 0,
    pharmacy: 0,
    default: 0,
  };

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    if (qty <= 0 || price <= 0) continue;
    const lineTotal = round2(qty * price);
    const cat = item.category ?? "other";

    if (cat === "consultation" && hasConsultationRule) {
      subtotals.consultation = round2(subtotals.consultation + lineTotal);
    } else if (cat === "lab" && hasLabRule) {
      subtotals.lab = round2(subtotals.lab + lineTotal);
    } else if (
      (cat === "pharmacy" || cat === "prescription") &&
      hasPharmacyRule
    ) {
      subtotals.pharmacy = round2(subtotals.pharmacy + lineTotal);
    } else {
      subtotals.default = round2(subtotals.default + lineTotal);
    }
  }

  const gross = round2(
    subtotals.consultation +
      subtotals.lab +
      subtotals.pharmacy +
      subtotals.default,
  );

  const breakdown: CategoryDeductionBreakdown[] = [];
  for (const bucket of [
    "consultation",
    "lab",
    "pharmacy",
    "default",
  ] as const) {
    const subtotal = subtotals[bucket];
    if (subtotal <= 0) continue;
    const rule = bucketRules[bucket];
    const deduction = computeDeduction(rule, subtotal);
    breakdown.push({
      bucket,
      subtotal,
      deduction_type: rule.deduction_type,
      deduction_value: rule.deduction_value,
      deduction,
    });
  }

  const rawDeduction = round2(
    breakdown.reduce((sum, b) => sum + b.deduction, 0),
  );
  const deduction = Math.min(gross, rawDeduction);
  const net = round2(Math.max(0, gross - deduction));

  return {
    gross,
    deduction,
    net,
    breakdown,
  };
}

/**
 * A policy is usable at billing when both the policy and its provider are
 * active, today falls inside the validity window (open-ended when a bound is
 * null), and the provider's covered-visits limit is not exhausted.
 */
export function isPolicyEligible(
  policy: PolicyEligibilityInput,
  today: Date = new Date(),
): boolean {
  if (!policy.is_active || !policy.provider.is_active) return false;

  if (policy.valid_from && startOfDay(today) < startOfDay(policy.valid_from)) {
    return false;
  }
  if (policy.valid_to && startOfDay(today) > startOfDay(policy.valid_to)) {
    return false;
  }

  const limit = policy.provider.covered_visits;
  if (limit !== null && policy.visits_used >= limit) return false;

  return true;
}

/** Visits left on a policy; null = unlimited. */
export function remainingVisits(
  coveredVisits: number | null,
  visitsUsed: number,
): number | null {
  if (coveredVisits === null) return null;
  return Math.max(0, coveredVisits - visitsUsed);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}
