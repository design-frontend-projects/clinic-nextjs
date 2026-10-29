import { describe, expect, it } from "vitest";

import {
  computeCategoryDeductions,
  computeDeduction,
  isPolicyEligible,
  remainingVisits,
  type PolicyEligibilityInput,
} from "../insurance";
import {
  billingCatalogItemSchema,
  updateInvoiceItemsSchema,
} from "@/types/billing.types";
import {
  createInvoiceSchema,
  insuranceProviderSchema,
} from "@/types/insurance.types";

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
      computeDeduction(
        { deduction_type: "percentage", deduction_value: 0 },
        100,
      ),
    ).toBe(0);
  });
});

describe("computeCategoryDeductions", () => {
  it("applies default rule once across all items when no category overrides are set", () => {
    const result = computeCategoryDeductions(
      {
        deduction_type: "fixed",
        deduction_value: 40,
      },
      [
        { category: "consultation", quantity: 1, unit_price: 100 },
        { category: "lab", quantity: 2, unit_price: 50 },
      ],
    );

    expect(result.gross).toBe(200);
    expect(result.deduction).toBe(40);
    expect(result.net).toBe(160);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]?.bucket).toBe("default");
  });

  it("computes independent deductions per category (consultation, lab, pharmacy) and sums them", () => {
    const result = computeCategoryDeductions(
      {
        deduction_type: "percentage",
        deduction_value: 10,
        consultation_deduction_type: "fixed",
        consultation_deduction_value: 30,
        lab_deduction_type: "percentage",
        lab_deduction_value: 50,
        pharmacy_deduction_type: "percentage",
        pharmacy_deduction_value: 20,
      },
      [
        { category: "consultation", quantity: 1, unit_price: 100 }, // -$30 fixed
        { category: "lab", quantity: 2, unit_price: 40 }, // $80 * 50% = -$40
        { category: "prescription", quantity: 1, unit_price: 50 }, // $50 * 20% = -$10 (maps to pharmacy bucket)
        { category: "procedure", quantity: 1, unit_price: 100 }, // $100 * 10% default = -$10
      ],
    );

    expect(result.gross).toBe(330);
    expect(result.deduction).toBe(90); // 30 + 40 + 10 + 10
    expect(result.net).toBe(240);
    expect(result.breakdown).toEqual([
      {
        bucket: "consultation",
        subtotal: 100,
        deduction_type: "fixed",
        deduction_value: 30,
        deduction: 30,
      },
      {
        bucket: "lab",
        subtotal: 80,
        deduction_type: "percentage",
        deduction_value: 50,
        deduction: 40,
      },
      {
        bucket: "pharmacy",
        subtotal: 50,
        deduction_type: "percentage",
        deduction_value: 20,
        deduction: 10,
      },
      {
        bucket: "default",
        subtotal: 100,
        deduction_type: "percentage",
        deduction_value: 10,
        deduction: 10,
      },
    ]);
  });

  it("clamps category fixed deduction to that category's subtotal", () => {
    const result = computeCategoryDeductions(
      {
        deduction_type: "fixed",
        deduction_value: 10,
        lab_deduction_type: "fixed",
        lab_deduction_value: 100,
      },
      [
        { category: "lab", quantity: 1, unit_price: 35 }, // capped at 35
        { category: "consultation", quantity: 1, unit_price: 100 }, // default fixed 10
      ],
    );

    expect(result.gross).toBe(135);
    expect(result.deduction).toBe(45);
    expect(result.net).toBe(90);
  });
});

describe("Billing & Insurance Zod Schemas", () => {
  it("validates bilingual catalog items with price and category", () => {
    const valid = billingCatalogItemSchema.safeParse({
      name_en: "Blood CBC Test",
      name_ar: "تحليل صورة دم كاملة",
      category: "lab",
      price: "45.50",
      is_active: true,
    });
    expect(valid.success).toBe(true);

    const missingAr = billingCatalogItemSchema.safeParse({
      name_en: "Blood CBC Test",
      name_ar: "   ",
      category: "lab",
      price: 45,
    });
    expect(missingAr.success).toBe(false);
  });

  it("rejects category percentage > 100 on insuranceProviderSchema", () => {
    const invalid = insuranceProviderSchema.safeParse({
      name: "CarePlus",
      deduction_type: "fixed",
      deduction_value: 25,
      lab_deduction_type: "percentage",
      lab_deduction_value: 120,
    });
    expect(invalid.success).toBe(false);

    const valid = insuranceProviderSchema.safeParse({
      name: "CarePlus",
      deduction_type: "fixed",
      deduction_value: 25,
      consultation_deduction_type: "fixed",
      consultation_deduction_value: 40,
      lab_deduction_type: "percentage",
      lab_deduction_value: 80,
      pharmacy_deduction_type: "percentage",
      pharmacy_deduction_value: 50,
    });
    expect(valid.success).toBe(true);
  });

  it("validates createInvoiceSchema and updateInvoiceItemsSchema with catalog_item_id and category", () => {
    const invoiceId = "11111111-1111-4111-8111-111111111111";
    const patientId = "22222222-2222-4222-8222-222222222222";
    const catalogId = "33333333-3333-4333-8333-333333333333";

    const createRes = createInvoiceSchema.safeParse({
      patient_id: patientId,
      apply_insurance: true,
      items: [
        {
          catalog_item_id: catalogId,
          category: "consultation",
          description: "General Consultation",
          quantity: 1,
          unit_price: 75,
        },
      ],
    });
    expect(createRes.success).toBe(true);

    const updateRes = updateInvoiceItemsSchema.safeParse({
      invoice_id: invoiceId,
      apply_insurance: true,
      items: [
        {
          catalog_item_id: catalogId,
          category: "lab",
          description: "Lipid Profile",
          quantity: 2,
          unit_price: 30,
        },
      ],
    });
    expect(updateRes.success).toBe(true);
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
