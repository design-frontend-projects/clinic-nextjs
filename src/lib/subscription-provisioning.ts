/**
 * Pure helpers for provisioning a tenant subscription outside the onboarding
 * wizard. Both mirror inline logic in `saveClinicStep`
 * (src/app/actions/onboarding.ts:207-260) — keep them in sync if the wizard's
 * billing-window or legacy-tier rules change.
 */

const MONTHS_BY_PERIOD: Record<string, number | null> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
  lifetime: null,
};

/**
 * Derive the subscription window from a plan's billing period. Lifetime plans
 * have no end date. Unknown periods fall back to monthly.
 */
export function subscriptionWindow(
  billingPeriod: string,
  start: Date = new Date(),
): { startDate: Date; endDate: Date | null } {
  // Note: `?? 1` would coerce lifetime's null to 1 — look up with `in` so
  // lifetime keeps its open-ended window and only unknown periods fall back.
  const months =
    billingPeriod in MONTHS_BY_PERIOD ? MONTHS_BY_PERIOD[billingPeriod] : 1;
  if (months === null) {
    return { startDate: start, endDate: null };
  }
  const endDate = new Date(start);
  endDate.setMonth(endDate.getMonth() + months);
  return { startDate: start, endDate };
}

/**
 * Map a plan to the legacy `clinics.subscription_plan` tier string consumed by
 * src/lib/subscription.ts (free < pro < enterprise). Unknown paid plan names
 * map to "pro" so paid plans aren't gated as free.
 */
export function planToLegacyTier(plan: {
  name: string;
  price: unknown;
}): "free" | "pro" | "enterprise" {
  if (Number(plan.price) === 0) return "free";
  return plan.name.toLowerCase().includes("enterprise") ? "enterprise" : "pro";
}
