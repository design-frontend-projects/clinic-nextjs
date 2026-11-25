import { describe, expect, it } from "vitest";
import {
  evaluateTenantAccess,
  formatRequestRef,
  type TenantAccessInput,
} from "../tenant-access";

const BASE_NOW = new Date("2026-06-15T12:00:00Z");

function makeInput(
  overrides: Partial<TenantAccessInput> = {},
): TenantAccessInput {
  return {
    role: "owner",
    profileStatus: "active",
    clinic: {
      status: "active",
      request_ref: "REQ-2026-0001",
      rejection_reason: null,
      activated_at: new Date("2026-06-01T00:00:00Z"),
    },
    subscription: {
      status: "active",
      payment_status: "paid",
      start_date: new Date("2026-06-01T00:00:00Z"),
      end_date: new Date("2026-07-01T00:00:00Z"),
      activated_at: new Date("2026-06-01T00:00:00Z"),
      billing_cycle: "monthly",
      price: 99,
      grace_period_days: 7,
    },
    ...overrides,
  };
}

describe("formatRequestRef", () => {
  it("pads sequence numbers to 4 digits with year prefix", () => {
    expect(formatRequestRef(1, 2026)).toBe("REQ-2026-0001");
    expect(formatRequestRef(42n, 2026)).toBe("REQ-2026-0042");
    expect(formatRequestRef(12345, 2026)).toBe("REQ-2026-12345");
  });
});

describe("evaluateTenantAccess", () => {
  it("allows active/inactive app_owner regardless of clinic or subscription state", () => {
    const res = evaluateTenantAccess(
      makeInput({
        role: "app_owner",
        profileStatus: "inactive",
        clinic: { status: "suspended", request_ref: null },
        subscription: null,
      }),
      BASE_NOW,
    );
    expect(res).toEqual({ allowed: true, warning: null });
  });

  it("denies blocked app_owner profiles with account_blocked", () => {
    const res = evaluateTenantAccess(
      makeInput({
        role: "app_owner",
        profileStatus: "blocked",
        clinic: null,
        subscription: null,
      }),
      BASE_NOW,
    );
    expect(res).toEqual({ allowed: false, code: "account_blocked" });
  });

  it("denies blocked profiles", () => {
    const res = evaluateTenantAccess(
      makeInput({ profileStatus: "blocked" }),
      BASE_NOW,
    );
    expect(res).toEqual({ allowed: false, code: "account_blocked" });
  });

  it("denies under_review clinics with reference number even when profile is inactive", () => {
    const res = evaluateTenantAccess(
      makeInput({
        profileStatus: "inactive",
        clinic: {
          status: "under_review",
          request_ref: "REQ-2026-0012",
        },
        subscription: {
          status: "pending_approval",
          payment_status: "pending",
          start_date: BASE_NOW,
          end_date: null,
          billing_cycle: "monthly",
          price: 49,
        },
      }),
      BASE_NOW,
    );
    expect(res).toEqual({
      allowed: false,
      code: "under_review",
      requestRef: "REQ-2026-0012",
    });
  });

  it("denies rejected clinics with reference number and reason", () => {
    const res = evaluateTenantAccess(
      makeInput({
        profileStatus: "inactive",
        clinic: {
          status: "rejected",
          request_ref: "REQ-2026-0013",
          rejection_reason: "Invalid registration document",
        },
      }),
      BASE_NOW,
    );
    expect(res).toEqual({
      allowed: false,
      code: "rejected",
      requestRef: "REQ-2026-0013",
      reason: "Invalid registration document",
    });
  });

  it("denies suspended clinics across all clinic roles (doctor/staff/owner)", () => {
    for (const role of ["owner", "admin", "doctor", "staff", "pharmacist"]) {
      const res = evaluateTenantAccess(
        makeInput({ role, clinic: { status: "suspended" } }),
        BASE_NOW,
      );
      expect(res).toEqual({ allowed: false, code: "suspended" });
    }
  });

  it("denies inactive profiles on an active clinic", () => {
    const res = evaluateTenantAccess(
      makeInput({ profileStatus: "inactive" }),
      BASE_NOW,
    );
    expect(res).toEqual({ allowed: false, code: "account_inactive" });
  });

  it("denies clinics with missing, suspended, or cancelled subscriptions", () => {
    expect(
      evaluateTenantAccess(makeInput({ subscription: null }), BASE_NOW),
    ).toEqual({ allowed: false, code: "no_subscription" });

    expect(
      evaluateTenantAccess(
        makeInput({
          subscription: {
            ...makeInput().subscription!,
            status: "suspended",
          },
        }),
        BASE_NOW,
      ),
    ).toEqual({ allowed: false, code: "subscription_suspended" });

    expect(
      evaluateTenantAccess(
        makeInput({
          subscription: {
            ...makeInput().subscription!,
            status: "cancelled",
          },
        }),
        BASE_NOW,
      ),
    ).toEqual({ allowed: false, code: "subscription_cancelled" });
  });

  it("enforces payment_status=paid for paid active plans, and denies pending/refunded", () => {
    expect(
      evaluateTenantAccess(
        makeInput({
          subscription: {
            ...makeInput().subscription!,
            payment_status: "pending",
          },
        }),
        BASE_NOW,
      ),
    ).toEqual({ allowed: false, code: "payment_pending" });

    expect(
      evaluateTenantAccess(
        makeInput({
          subscription: {
            ...makeInput().subscription!,
            payment_status: "refunded",
          },
        }),
        BASE_NOW,
      ),
    ).toEqual({ allowed: false, code: "payment_refunded" });
  });

  it("exempts free plans (price=0) and trial clinics from payment_status=paid requirement", () => {
    expect(
      evaluateTenantAccess(
        makeInput({
          subscription: {
            ...makeInput().subscription!,
            price: 0,
            payment_status: "pending",
          },
        }),
        BASE_NOW,
      ),
    ).toEqual({ allowed: true, warning: null });

    expect(
      evaluateTenantAccess(
        makeInput({
          clinic: { status: "trial" },
          subscription: {
            ...makeInput().subscription!,
            price: 99,
            payment_status: "pending",
          },
        }),
        BASE_NOW,
      ),
    ).toEqual({ allowed: true, warning: null });
  });

  it("denies access before start_date", () => {
    const res = evaluateTenantAccess(
      makeInput({
        subscription: {
          ...makeInput().subscription!,
          start_date: new Date("2026-07-01T00:00:00Z"),
          end_date: new Date("2026-08-01T00:00:00Z"),
        },
      }),
      BASE_NOW,
    );
    expect(res).toEqual({
      allowed: false,
      code: "subscription_not_started",
      startDate: "2026-07-01T00:00:00.000Z",
    });
  });

  it("allows lifetime subscriptions indefinitely", () => {
    const farFuture = new Date("2099-01-01T00:00:00Z");
    const res = evaluateTenantAccess(
      makeInput({
        subscription: {
          ...makeInput().subscription!,
          end_date: null,
          billing_cycle: "lifetime",
        },
      }),
      farFuture,
    );
    expect(res).toEqual({ allowed: true, warning: null });
  });

  it("falls back to activated_at + billing_cycle when end_date is null", () => {
    const afterOneMonth = new Date("2026-07-15T00:00:00Z");
    const res = evaluateTenantAccess(
      makeInput({
        subscription: {
          ...makeInput().subscription!,
          start_date: new Date("2026-06-01T00:00:00Z"),
          activated_at: new Date("2026-06-01T00:00:00Z"),
          end_date: null,
          billing_cycle: "monthly",
          grace_period_days: 7,
        },
      }),
      afterOneMonth,
    );
    expect(res).toEqual({
      allowed: false,
      code: "subscription_expired",
      endDate: "2026-07-01T00:00:00.000Z",
      graceDeadline: "2026-07-08T00:00:00.000Z",
    });
  });

  it("allows access with grace_period warning between end_date and end_date + grace_period_days", () => {
    const twoDaysPastExpiry = new Date("2026-07-03T00:00:00Z");
    const res = evaluateTenantAccess(makeInput(), twoDaysPastExpiry);
    expect(res).toEqual({
      allowed: true,
      warning: {
        code: "grace_period",
        endDate: "2026-07-01T00:00:00.000Z",
        graceDeadline: "2026-07-08T00:00:00.000Z",
        daysRemaining: 5,
      },
    });
  });

  it("denies access once grace_period_days has elapsed (or when grace_period_days = 0)", () => {
    const afterGrace = new Date("2026-07-08T00:00:01Z");
    expect(evaluateTenantAccess(makeInput(), afterGrace)).toEqual({
      allowed: false,
      code: "subscription_expired",
      endDate: "2026-07-01T00:00:00.000Z",
      graceDeadline: "2026-07-08T00:00:00.000Z",
    });

    const justPastExpiry = new Date("2026-07-01T00:00:01Z");
    expect(
      evaluateTenantAccess(
        makeInput({
          subscription: {
            ...makeInput().subscription!,
            grace_period_days: 0,
          },
        }),
        justPastExpiry,
      ),
    ).toEqual({
      allowed: false,
      code: "subscription_expired",
      endDate: "2026-07-01T00:00:00.000Z",
      graceDeadline: "2026-07-01T00:00:00.000Z",
    });
  });
});
