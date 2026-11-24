import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  invoices: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireTenantInfo: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/user-creation", () => ({
  findClinicDuplicate: vi.fn(),
  duplicateMessage: vi.fn(),
}));
vi.mock("@/lib/appointment-service", () => ({
  createAppointmentForScope: vi.fn(),
  registerPatientWithAppointmentForScope: vi.fn(),
}));

import { requireTenantInfo } from "@/lib/auth";
import { getInvoices } from "@/app/actions/admin";

const mockTenant = vi.mocked(requireTenantInfo);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const CREATOR_ID = "55555555-5555-4555-8555-555555555555";

function assertPlainSerializable(value: unknown, path = "root"): void {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertPlainSerializable(item, `${path}[${index}]`);
    });
    return;
  }

  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    expect(
      proto,
      `Expected plain object at ${path}, got ${proto?.constructor?.name ?? String(proto)}`,
    ).toBe(Object.prototype);

    for (const [key, propValue] of Object.entries(value)) {
      assertPlainSerializable(propValue, `${path}.${key}`);
    }
    return;
  }

  throw new Error(`Unexpected non-serializable type ${typeof value} at ${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTenant.mockResolvedValue({
    userId: "user-1",
    orgId: null,
    profileId: CREATOR_ID,
    role: "admin",
    fullName: "Admin User",
    email: "admin@clinic.test",
    is_profile_completed: true,
    is_owner: false,
    clinicId: CLINIC_ID,
    clinicName: "Test Clinic",
    subscriptionPlan: "pro",
    branchId: BRANCH_ID,
    branchName: "Main Branch",
    branchLocked: false,
    auth_user_id: "user-1",
  });
});

describe("getInvoices serialization", () => {
  it("converts all Prisma Decimal and Date values into plain serializable values", async () => {
    const createdAt = new Date("2026-11-24T10:00:00.000Z");
    const updatedAt = new Date("2026-11-24T10:30:00.000Z");
    const paidAt = new Date("2026-11-24T11:00:00.000Z");

    prismaMock.invoices.findMany.mockResolvedValue([
      {
        id: "inv-1",
        clinic_id: CLINIC_ID,
        branch_id: BRANCH_ID,
        patient_id: PATIENT_ID,
        created_by: CREATOR_ID,
        invoice_type: "visit",
        total_amount: new Prisma.Decimal("250.75"),
        status: "paid",
        created_at: createdAt,
        deleted_at: null,
        invoice_number: "INV-0001",
        updated_at: updatedAt,
        creator: {
          id: CREATOR_ID,
          full_name: "Dr. Jane",
          role: "doctor",
        },
        patients: {
          id: PATIENT_ID,
          first_name: "John",
          last_name: "Doe",
          phone: "+15550001111",
          email: "john@example.com",
        },
        invoice_items: [
          {
            id: "item-1",
            catalog_item_id: "cat-1",
            category: "consultation",
            description: "Consultation",
            quantity: 1,
            unit_price: new Prisma.Decimal("250.75"),
            total_price: new Prisma.Decimal("250.75"),
          },
        ],
        payments: [
          {
            id: "pay-1",
            amount: new Prisma.Decimal("200.25"),
            payment_method: "card",
            status: "paid",
            paid_at: paidAt,
          },
          {
            id: "pay-2",
            amount: new Prisma.Decimal("0.00"),
            payment_method: "cash",
            status: "pending",
            paid_at: null,
          },
        ],
        insurance_claims: [
          {
            id: "claim-1",
            claim_amount: new Prisma.Decimal("50.50"),
            status: "submitted",
            patient_insurances: {
              insurance_providers: {
                name: "CareShield",
              },
            },
          },
        ],
        _count: {
          invoice_history: 2,
        },
      },
      {
        id: "inv-2",
        clinic_id: CLINIC_ID,
        branch_id: null,
        patient_id: null,
        created_by: null,
        invoice_type: null,
        total_amount: new Prisma.Decimal("0.00"),
        status: "draft",
        created_at: createdAt,
        deleted_at: null,
        invoice_number: null,
        updated_at: updatedAt,
        creator: null,
        patients: null,
        invoice_items: [
          {
            id: "item-2",
            catalog_item_id: null,
            category: "other",
            description: "Complimentary check",
            quantity: 1,
            unit_price: new Prisma.Decimal("0.00"),
            total_price: null,
          },
        ],
        payments: [],
        insurance_claims: [
          {
            id: "claim-2",
            claim_amount: null,
            status: "submitted",
            patient_insurances: null,
          },
        ],
        _count: {
          invoice_history: 0,
        },
      },
      {
        id: "inv-3",
        clinic_id: CLINIC_ID,
        branch_id: null,
        patient_id: null,
        created_by: null,
        invoice_type: "visit",
        total_amount: null,
        status: "draft",
        created_at: createdAt,
        deleted_at: null,
        invoice_number: null,
        updated_at: updatedAt,
        creator: null,
        patients: null,
        invoice_items: [],
        payments: [],
        insurance_claims: [],
        _count: {
          invoice_history: 0,
        },
      },
    ]);

    const result = await getInvoices();

    expect(prismaMock.invoices.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clinic_id: CLINIC_ID },
      }),
    );

    assertPlainSerializable(result);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: "inv-1",
      clinic_id: CLINIC_ID,
      branch_id: BRANCH_ID,
      patient_id: PATIENT_ID,
      created_by: CREATOR_ID,
      invoice_number: "INV-0001",
      invoice_type: "visit",
      total_amount: 250.75,
      status: "paid",
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      creator: {
        id: CREATOR_ID,
        full_name: "Dr. Jane",
        role: "doctor",
      },
      patients: {
        id: PATIENT_ID,
        first_name: "John",
        last_name: "Doe",
        phone: "+15550001111",
        email: "john@example.com",
      },
      invoice_items: [
        {
          id: "item-1",
          catalog_item_id: "cat-1",
          category: "consultation",
          description: "Consultation",
          quantity: 1,
          unit_price: 250.75,
          total_price: 250.75,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 200.25,
          payment_method: "card",
          status: "paid",
          paid_at: paidAt.toISOString(),
        },
        {
          id: "pay-2",
          amount: 0,
          payment_method: "cash",
          status: "pending",
          paid_at: null,
        },
      ],
      insurance_claims: [
        {
          id: "claim-1",
          claim_amount: 50.5,
          status: "submitted",
          patient_insurances: {
            insurance_providers: {
              name: "CareShield",
            },
          },
        },
      ],
      _count: {
        invoice_history: 2,
      },
    });

    // Zero Decimal values must become 0, while null stays null.
    expect(result[1].total_amount).toBe(0);
    expect(result[1].invoice_items[0].unit_price).toBe(0);
    expect(result[1].invoice_items[0].total_price).toBeNull();
    expect(result[1].insurance_claims[0].claim_amount).toBeNull();
    expect(result[2].total_amount).toBeNull();
  });
});
