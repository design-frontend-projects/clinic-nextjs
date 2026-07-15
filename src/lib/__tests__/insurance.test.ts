import { describe, expect, it } from "vitest";

import {
  computeDeduction,
  isPolicyEligible,
  remainingVisits,
  type PolicyEligibilityInput,
} from "../insurance";

describe("computeDeduction", () => {
  it("deducts a fixed amount", () => {
    expect(
      computeDeduction({ deduction_type: "fixed", deduction_value: 50 }, 200),
    ).toBe(50);
  });

  it("clamps a fixed deduction to the gross", () => {
    expect(
      computeDeduction({ deduction_type: "fixed", deduction_value: 500 }, 120),
    ).toBe(120);
  });

  it("deducts a percentage of the gross", () => {
    expect(
      computeDeduction(
        { deduction_type: "percentage", deduction_value: 10 },
        250,
      ),
    ).toBe(25);
  });

  it("rounds percentage deductions to 2 decimals", () => {
    expect(
      computeDeduction(
        { deduction_type: "percentage", deduction_value: 33.33 },
        100,
      ),
    ).toBe(33.33);
    expect(
      computeDeduction(
        { deduction_type: "percentage", deduction_value: 15 },
        99.99,
      ),
    ).toBe(15);
  });

  it("caps percentages above 100 at the full gross", () => {
    expect(
      computeDeduction(
        { deduction_type: "percentage", deduction_value: 150 },
        80,
      ),
    ).toBe(80);
  });

  it("returns 0 for non-positive gross or rule value", () => {
    expect(
      computeDeduction({ deduction_type: "fixed", deduction_value: 50 }, 0),
    ).toBe(0);
    expect(
      computeDeduction({ deduction_type: "percentage", deduction_value: 0 }, 100),
    ).toBe(0);
  });
});

describe("isPolicyEligible", () => {
  const base: PolicyEligibilityInput = {
    is_active: true,
    valid_from: null,
    valid_to: null,
    visits_used: 0,
    provider: { is_active: true, covered_visits: null },
  };
  const today = new Date("2026-07-15T12:00:00Z");

  it("accepts an open-ended active policy", () => {
    expect(isPolicyEligible(base, today)).toBe(true);
  });

  it("rejects an inactive policy or provider", () => {
    expect(isPolicyEligible({ ...base, is_active: false }, today)).toBe(false);
    expect(
      isPolicyEligible(
        { ...base, provider: { ...base.provider, is_active: false } },
        today,
      ),
    ).toBe(false);
  });

  it("rejects a policy outside its validity window", () => {
    expect(
      isPolicyEligible({ ...base, valid_from: new Date("2026-08-01") }, today),
    ).toBe(false);
    expect(
      isPolicyEligible({ ...base, valid_to: new Date("2026-06-30") }, today),
    ).toBe(false);
  });

  it("accepts boundary dates (inclusive window)", () => {
    expect(
      isPolicyEligible(
        {
          ...base,
          valid_from: new Date("2026-07-15"),
          valid_to: new Date("2026-07-15"),
        },
        today,
      ),
    ).toBe(true);
  });

  it("rejects a policy with exhausted covered visits", () => {
    expect(
      isPolicyEligible(
        {
          ...base,
          visits_used: 5,
          provider: { is_active: true, covered_visits: 5 },
        },
        today,
      ),
    ).toBe(false);
  });

  it("accepts when visits remain or the limit is unlimited", () => {
    expect(
      isPolicyEligible(
        {
          ...base,
          visits_used: 4,
          provider: { is_active: true, covered_visits: 5 },
        },
        today,
      ),
    ).toBe(true);
    expect(isPolicyEligible({ ...base, visits_used: 999 }, today)).toBe(true);
  });
});

describe("remainingVisits", () => {
  it("returns null for unlimited coverage", () => {
    expect(remainingVisits(null, 3)).toBeNull();
  });

  it("counts down and never goes negative", () => {
    expect(remainingVisits(5, 2)).toBe(3);
    expect(remainingVisits(5, 7)).toBe(0);
  });
});
