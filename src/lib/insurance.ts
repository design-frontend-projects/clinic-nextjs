import type { DeductionType } from "@/types/insurance.types";

export interface DeductionRule {
  deduction_type: DeductionType;
  /** Fixed amount or percentage (0–100) depending on deduction_type. */
  deduction_value: number;
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
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
