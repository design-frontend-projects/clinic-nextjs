import { subscriptionWindow } from "@/lib/subscription-provisioning";

export type TenantAccessDeniedCode =
  | "under_review"
  | "rejected"
  | "suspended"
  | "account_blocked"
  | "account_inactive"
  | "no_subscription"
  | "subscription_suspended"
  | "subscription_cancelled"
  | "payment_pending"
  | "payment_refunded"
  | "subscription_not_started"
  | "subscription_expired";

export type TenantAccessDenied = {
  allowed: false;
  code: TenantAccessDeniedCode;
  requestRef?: string | null;
  reason?: string | null;
  startDate?: string;
  endDate?: string;
  graceDeadline?: string;
};

export type TenantAccessWarning = {
  code: "grace_period";
  endDate: string;
  graceDeadline: string;
  daysRemaining: number;
};

export type TenantAccessAllowed = {
  allowed: true;
  warning: TenantAccessWarning | null;
};

export type TenantAccessResult = TenantAccessAllowed | TenantAccessDenied;

export interface TenantAccessInput {
  role: string | null | undefined;
  profileStatus: string | null | undefined;
  clinic: {
    status: string;
    request_ref?: string | null;
    rejection_reason?: string | null;
    activated_at?: Date | string | null;
  } | null;
  subscription: {
    status: string;
    payment_status: string;
    start_date: Date | string;
    end_date?: Date | string | null;
    activated_at?: Date | string | null;
    billing_cycle: string;
    price: number | string;
    grace_period_days?: number | null;
  } | null;
}

const MS_PER_DAY = 86_400_000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a numeric sequence value into a human-readable tenant request
 * reference number (e.g. `REQ-2026-0001`).
 */
export function formatRequestRef(
  seq: number | bigint,
  year: number = new Date().getUTCFullYear(),
): string {
  return `REQ-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Evaluate whether a signed-in user is permitted to access their tenant
 * workspace. Applies across both login (`completeSignIn`) and active sessions
 * (`getTenantInfo` / `requireTenantInfo` / `resolveDashboardTenant`).
 *
 * `app_owner` accounts are always exempt. All clinic roles (owner, admin,
 * doctor, staff, receptionist, pharmacist, patient) are checked against:
 *  1. Profile status (`blocked` / `inactive`)
 *  2. Clinic approval & operational status (`under_review`, `rejected`, `suspended`)
 *  3. Subscription status (`pending_approval`, `suspended`, `cancelled`)
 *  4. Payment status (`paid` required unless `clinic.status === "trial"` or free plan `price === 0`)
 *  5. Subscription date window (`start_date <= now <= end_date` or `activated_at + billing_cycle`)
 *     with a configurable `grace_period_days` warning window before lockout.
 */
export function evaluateTenantAccess(
  input: TenantAccessInput,
  now: Date = new Date(),
): TenantAccessResult {
  if (input.role === "app_owner") {
    return { allowed: true, warning: null };
  }

  if (input.profileStatus === "blocked") {
    return { allowed: false, code: "account_blocked" };
  }

  // Check clinic status before profile `inactive` so under_review/rejected owners
  // receive their reference number or rejection reason instead of a generic inactive error.
  if (input.clinic) {
    if (input.clinic.status === "under_review") {
      return {
        allowed: false,
        code: "under_review",
        requestRef: input.clinic.request_ref ?? null,
      };
    }

    if (input.clinic.status === "rejected") {
      return {
        allowed: false,
        code: "rejected",
        requestRef: input.clinic.request_ref ?? null,
        reason: input.clinic.rejection_reason ?? null,
      };
    }

    if (input.clinic.status === "suspended") {
      return { allowed: false, code: "suspended" };
    }
  }

  if (input.profileStatus === "inactive") {
    return { allowed: false, code: "account_inactive" };
  }

  // No clinic linked (handled by existing no-clinic layout notice).
  if (!input.clinic) {
    return { allowed: true, warning: null };
  }

  const sub = input.subscription;
  if (!sub) {
    return { allowed: false, code: "no_subscription" };
  }

  if (sub.status === "pending_approval") {
    return {
      allowed: false,
      code: "under_review",
      requestRef: input.clinic.request_ref ?? null,
    };
  }

  if (sub.status === "suspended") {
    return { allowed: false, code: "subscription_suspended" };
  }

  if (sub.status === "cancelled") {
    return { allowed: false, code: "subscription_cancelled" };
  }

  const isFreePlan = Number(sub.price) === 0;
  const isTrialClinic = input.clinic.status === "trial";
  if (!isFreePlan && !isTrialClinic && sub.payment_status !== "paid") {
    return {
      allowed: false,
      code:
        sub.payment_status === "refunded"
          ? "payment_refunded"
          : "payment_pending",
    };
  }

  const startDate = toDate(sub.start_date);
  if (startDate && now.getTime() < startDate.getTime()) {
    return {
      allowed: false,
      code: "subscription_not_started",
      startDate: startDate.toISOString(),
    };
  }

  let effectiveEndDate = toDate(sub.end_date);
  if (!effectiveEndDate && sub.billing_cycle !== "lifetime") {
    const anchor =
      toDate(sub.activated_at) ??
      toDate(input.clinic.activated_at) ??
      startDate;
    if (anchor) {
      effectiveEndDate = subscriptionWindow(sub.billing_cycle, anchor).endDate;
    }
  }

  if (effectiveEndDate && now.getTime() > effectiveEndDate.getTime()) {
    const graceDays = Math.max(0, Number(sub.grace_period_days ?? 7));
    const graceDeadline = new Date(
      effectiveEndDate.getTime() + graceDays * MS_PER_DAY,
    );

    if (graceDays > 0 && now.getTime() <= graceDeadline.getTime()) {
      const daysRemaining = Math.max(
        1,
        Math.ceil((graceDeadline.getTime() - now.getTime()) / MS_PER_DAY),
      );
      return {
        allowed: true,
        warning: {
          code: "grace_period",
          endDate: effectiveEndDate.toISOString(),
          graceDeadline: graceDeadline.toISOString(),
          daysRemaining,
        },
      };
    }

    return {
      allowed: false,
      code: "subscription_expired",
      endDate: effectiveEndDate.toISOString(),
      graceDeadline: graceDeadline.toISOString(),
    };
  }

  return { allowed: true, warning: null };
}
