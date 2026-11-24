import { describe, it, expect, vi, beforeEach } from "vitest";

const txMock = vi.hoisted(() => ({
  invoices: {
    create: vi.fn(),
    update: vi.fn(),
  },
  invoice_items: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  payments: {
    create: vi.fn(),
  },
  insurance_claims: {
    create: vi.fn(),
    update: vi.fn(),
  },
  patient_insurances: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  invoice_history: {
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  patients: {
    findFirst: vi.fn(),
  },
  invoices: {
    findFirst: vi.fn(),
  },
  invoice_history: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) =>
    cb(txMock),
  ),
}));

const auditMock = vi.hoisted(() => ({
  logChange: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireTenantInfo: vi.fn(),
}));
vi.mock("@/features/rbac/services/audit.service", () => ({
  auditService: auditMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireTenantInfo } from "@/lib/auth";
import {
  canEditInvoice,
  canMarkInvoiceAsPaid,
} from "@/lib/invoice-permissions";
import {
  createInvoice,
  getInvoiceHistory,
  markInvoiceAsPaid,
  updateInvoiceItems,
} from "@/app/actions/billing";

const mockTenant = vi.mocked(requireTenantInfo);

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const INVOICE_ID = "44444444-4444-4444-8444-444444444444";
const DOCTOR_CREATOR = "55555555-5555-4555-8555-555555555555";
const DOCTOR_OTHER = "66666666-6666-4666-8666-666666666666";
const ADMIN_USER = "77777777-7777-4777-8777-777777777777";
const OWNER_USER = "88888888-8888-4888-8888-888888888888";

function makeTenant(profileId: string, role: string) {
  return {
    userId: `user-${profileId}`,
    orgId: null,
    profileId,
    role,
    fullName: `${role} user`,
    email: `${role}@clinic.test`,
    is_profile_completed: true,
    is_owner: role === "owner",
    clinicId: CLINIC_ID,
    clinicName: "Test Clinic",
    subscriptionPlan: "pro",
    branchId: BRANCH_ID,
    branchName: "Main Branch",
    branchLocked: role === "doctor",
    auth_user_id: `user-${profileId}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTenant.mockResolvedValue(makeTenant(DOCTOR_CREATOR, "doctor"));
  txMock.patient_insurances.findMany.mockResolvedValue([]);
});

describe("invoice permissions matrix", () => {
  it("enforces creator-doctor lock once paid across roles and legacy invoices", () => {
    const paidByDoctor = { status: "paid", created_by: DOCTOR_CREATOR };
    const paidByAdmin = { status: "paid", created_by: ADMIN_USER };
    const paidLegacy = { status: "paid", created_by: null };
    const issued = { status: "issued", created_by: DOCTOR_CREATOR };
    const cancelled = { status: "cancelled", created_by: DOCTOR_CREATOR };

    expect(
      canEditInvoice(paidByDoctor, { profileId: DOCTOR_CREATOR, role: "doctor" }),
    ).toBe(true);
    expect(
      canEditInvoice(
        { status: "paid", created_by: OWNER_USER },
        { profileId: OWNER_USER, role: "owner" },
      ),
    ).toBe(true);
    expect(
      canEditInvoice(paidByDoctor, { profileId: DOCTOR_OTHER, role: "doctor" }),
    ).toBe(false);
    expect(
      canEditInvoice(paidByDoctor, { profileId: ADMIN_USER, role: "admin" }),
    ).toBe(false);
    expect(
      canEditInvoice(paidByDoctor, { profileId: OWNER_USER, role: "owner" }),
    ).toBe(false);
    expect(
      canEditInvoice(paidByAdmin, { profileId: ADMIN_USER, role: "admin" }),
    ).toBe(false);
    expect(
      canEditInvoice(paidLegacy, { profileId: DOCTOR_CREATOR, role: "doctor" }),
    ).toBe(false);
    expect(
      canEditInvoice(issued, { profileId: ADMIN_USER, role: "admin" }),
    ).toBe(true);
    expect(
      canEditInvoice(cancelled, { profileId: DOCTOR_CREATOR, role: "doctor" }),
    ).toBe(false);
    expect(
      canEditInvoice(issued, { profileId: "staff-1", role: "staff" }),
    ).toBe(false);

    expect(canMarkInvoiceAsPaid(issued, { role: "doctor" })).toBe(true);
    expect(canMarkInvoiceAsPaid(issued, { role: "admin" })).toBe(true);
    expect(canMarkInvoiceAsPaid(paidByDoctor, { role: "doctor" })).toBe(false);
    expect(canMarkInvoiceAsPaid(cancelled, { role: "doctor" })).toBe(false);
    expect(canMarkInvoiceAsPaid(issued, { role: "staff" })).toBe(false);
  });
});

describe("billing invoice lifecycle & history", () => {
  it("stamps created_by and writes a created entry to invoice_history on createInvoice", async () => {
    prismaMock.patients.findFirst.mockResolvedValue({ id: PATIENT_ID });

    const res = await createInvoice({
      patient_id: PATIENT_ID,
      apply_insurance: false,
      items: [
        {
          catalog_item_id: null,
          category: "consultation",
          description: "General Consultation",
          quantity: 1,
          unit_price: 150,
        },
      ],
    });

    expect(res).toMatchObject({ success: true, gross: 150, net: 150 });
    expect(txMock.invoices.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinic_id: CLINIC_ID,
        patient_id: PATIENT_ID,
        created_by: DOCTOR_CREATOR,
        total_amount: 150,
        status: "issued",
      }),
    });
    expect(txMock.invoice_history.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinic_id: CLINIC_ID,
        action: "created",
        changed_by: DOCTOR_CREATOR,
        changed_by_role: "doctor",
        new_data: expect.objectContaining({
          status: "issued",
          total_amount: 150,
          net_amount: 150,
          paid_amount: 0,
        }),
      }),
    });
    expect(auditMock.logChange).toHaveBeenCalledWith(
      CLINIC_ID,
      "invoice.created",
      expect.objectContaining({ entityType: "invoice" }),
    );
  });

  it("marks an issued invoice as paid, records a payment row, and logs marked_paid history", async () => {
    prismaMock.invoices.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      clinic_id: CLINIC_ID,
      status: "issued",
      total_amount: 200,
      invoice_items: [
        {
          catalog_item_id: null,
          category: "consultation",
          description: "Visit",
          quantity: 1,
          unit_price: 200,
          total_price: 200,
        },
      ],
      payments: [],
      insurance_claims: [{ claim_amount: 50 }],
    });

    const res = await markInvoiceAsPaid({
      invoice_id: INVOICE_ID,
      payment_method: "card",
      notes: "POS terminal #2",
    });

    expect(res).toEqual({
      success: true,
      invoice_id: INVOICE_ID,
      paid_amount: 150,
      total_paid: 150,
    });
    expect(txMock.payments.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoice_id: INVOICE_ID,
        clinic_id: CLINIC_ID,
        amount: 150,
        payment_method: "card",
        status: "paid",
      }),
    });
    expect(txMock.invoices.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: expect.objectContaining({ status: "paid" }),
    });
    expect(txMock.invoice_history.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoice_id: INVOICE_ID,
        action: "marked_paid",
        reason: "POS terminal #2",
        previous_data: expect.objectContaining({
          status: "issued",
          paid_amount: 0,
        }),
        new_data: expect.objectContaining({
          status: "paid",
          paid_amount: 150,
          payment_method: "card",
          payment_amount: 150,
        }),
      }),
    });
  });

  it("rejects markInvoiceAsPaid on already paid or cancelled invoices", async () => {
    prismaMock.invoices.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      clinic_id: CLINIC_ID,
      status: "paid",
      invoice_items: [],
      payments: [],
      insurance_claims: [],
    });

    const paidRes = await markInvoiceAsPaid({
      invoice_id: INVOICE_ID,
      payment_method: "cash",
    });
    expect(paidRes).toEqual({ error: "Invoice is already marked as paid." });
    expect(txMock.payments.create).not.toHaveBeenCalled();

    prismaMock.invoices.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      clinic_id: CLINIC_ID,
      status: "cancelled",
      invoice_items: [],
      payments: [],
      insurance_claims: [],
    });
    const cancelledRes = await markInvoiceAsPaid({
      invoice_id: INVOICE_ID,
      payment_method: "cash",
    });
    expect(cancelledRes).toEqual({
      error: "Cannot mark a cancelled invoice as paid.",
    });
  });

  it("blocks non-creator doctors, admins, and legacy null-creator users from editing a paid invoice", async () => {
    const basePaidInvoice = {
      id: INVOICE_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      status: "paid",
      created_by: DOCTOR_CREATOR,
      total_amount: 100,
      invoice_items: [],
      payments: [{ status: "paid", amount: 100 }],
      insurance_claims: [],
    };
    const payload = {
      invoice_id: INVOICE_ID,
      apply_insurance: false,
      edit_reason: "Adjustment",
      items: [
        {
          catalog_item_id: null,
          category: "consultation" as const,
          description: "Visit",
          quantity: 1,
          unit_price: 120,
        },
      ],
    };

    mockTenant.mockResolvedValue(makeTenant(DOCTOR_OTHER, "doctor"));
    prismaMock.invoices.findFirst.mockResolvedValue(basePaidInvoice);
    expect(await updateInvoiceItems(payload)).toEqual({
      error:
        "Only the doctor who created this invoice can edit it after payment.",
    });

    mockTenant.mockResolvedValue(makeTenant(ADMIN_USER, "admin"));
    expect(await updateInvoiceItems(payload)).toEqual({
      error:
        "Only the doctor who created this invoice can edit it after payment.",
    });

    mockTenant.mockResolvedValue(makeTenant(DOCTOR_CREATOR, "doctor"));
    prismaMock.invoices.findFirst.mockResolvedValue({
      ...basePaidInvoice,
      created_by: null,
    });
    expect(await updateInvoiceItems(payload)).toEqual({
      error:
        "Only the doctor who created this invoice can edit it after payment.",
    });
    expect(txMock.invoice_items.deleteMany).not.toHaveBeenCalled();
  });

  it("requires an edit reason when the creator doctor edits a paid invoice", async () => {
    prismaMock.invoices.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      status: "paid",
      created_by: DOCTOR_CREATOR,
      total_amount: 100,
      invoice_items: [],
      payments: [{ status: "paid", amount: 100 }],
      insurance_claims: [],
    });

    const res = await updateInvoiceItems({
      invoice_id: INVOICE_ID,
      apply_insurance: false,
      edit_reason: "  ",
      items: [
        {
          catalog_item_id: null,
          category: "consultation",
          description: "Visit",
          quantity: 1,
          unit_price: 120,
        },
      ],
    });

    expect(res).toEqual({
      error:
        "An edit reason (at least 3 characters) is required when modifying a paid invoice.",
    });
    expect(txMock.invoices.update).not.toHaveBeenCalled();
  });

  it("allows the creator doctor to edit a paid invoice with a reason, keeps status paid and payments intact, and logs edited_after_paid history", async () => {
    prismaMock.invoices.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_ID,
      status: "paid",
      created_by: DOCTOR_CREATOR,
      total_amount: 100,
      invoice_items: [
        {
          catalog_item_id: null,
          category: "consultation",
          description: "Visit",
          quantity: 1,
          unit_price: 100,
          total_price: 100,
        },
      ],
      payments: [{ status: "paid", amount: 100 }],
      insurance_claims: [],
    });

    const res = await updateInvoiceItems({
      invoice_id: INVOICE_ID,
      apply_insurance: false,
      edit_reason: "Added follow-up lab fee",
      items: [
        {
          catalog_item_id: null,
          category: "consultation",
          description: "Visit",
          quantity: 1,
          unit_price: 100,
        },
        {
          catalog_item_id: null,
          category: "lab",
          description: "CBC Panel",
          quantity: 1,
          unit_price: 40,
        },
      ],
    });

    expect(res).toMatchObject({ success: true, gross: 140, net: 140 });
    // Status stays paid; payment rows are untouched
    expect(txMock.invoices.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: expect.objectContaining({ total_amount: 140 }),
    });
    expect(txMock.payments.create).not.toHaveBeenCalled();
    expect(txMock.invoice_history.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoice_id: INVOICE_ID,
        action: "edited_after_paid",
        reason: "Added follow-up lab fee",
        changed_by: DOCTOR_CREATOR,
        previous_data: expect.objectContaining({
          status: "paid",
          total_amount: 100,
          paid_amount: 100,
        }),
        new_data: expect.objectContaining({
          status: "paid",
          total_amount: 140,
          paid_amount: 100,
        }),
      }),
    });
  });

  it("returns serialized invoice history entries scoped by clinic", async () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    prismaMock.invoices.findFirst.mockResolvedValue({ id: INVOICE_ID });
    prismaMock.invoice_history.findMany.mockResolvedValue([
      {
        id: "hist-1",
        invoice_id: INVOICE_ID,
        action: "marked_paid",
        changed_by: DOCTOR_CREATOR,
        changed_by_name: "Dr. Ali",
        changed_by_role: "doctor",
        reason: "Cash collected",
        previous_data: { status: "issued" },
        new_data: { status: "paid" },
        created_at: now,
      },
    ]);

    const entries = await getInvoiceHistory(INVOICE_ID);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "hist-1",
      action: "marked_paid",
      changed_by_name: "Dr. Ali",
      created_at: now.toISOString(),
    });
  });
});
