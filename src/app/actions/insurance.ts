"use server";

import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { isPolicyEligible, remainingVisits } from "@/lib/insurance";
import {
  assignPatientInsuranceSchema,
  insuranceProviderSchema,
  type AssignPatientInsuranceData,
  type DeductionType,
  type InsuranceProviderData,
  type InsuranceProviderRow,
  type PatientInsuranceRow,
} from "@/types/insurance.types";
import { revalidatePath } from "next/cache";

/**
 * Insurance companies and patient policies are managed by clinic owners,
 * admins, super_admins, and doctors.
 */
const INSURANCE_MANAGER_ROLES = [
  "owner",
  "admin",
  "super_admin",
  "doctor",
] as const;

async function requireInsuranceManager() {
  const tenant = await requireTenantInfo();
  if (!(INSURANCE_MANAGER_ROLES as readonly string[]).includes(tenant.role)) {
    throw new Error(
      "Unauthorized: insurance is managed by owners, admins, and doctors",
    );
  }
  return tenant;
}

function revalidateInsurancePages() {
  revalidatePath("/admin/insurance");
  revalidatePath("/doctor/insurance");
  revalidatePath("/admin/billing");
  revalidatePath("/doctor/billing");
}

function normalizeOptionalCategoryRule(
  type: DeductionType | null | undefined,
  value: number | null | undefined,
  defaultType: DeductionType,
): { type: DeductionType | null; value: number | null } {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return { type: null, value: null };
  }
  return {
    type: type ?? defaultType,
    value: Number(value),
  };
}

// ---------------------------------------------------------------------------
// Insurance companies (providers)
// ---------------------------------------------------------------------------

export async function getInsuranceProviders(): Promise<InsuranceProviderRow[]> {
  const tenant = await requireInsuranceManager();

  const rows = await prisma.insurance_providers.findMany({
    where: { clinic_id: tenant.clinicId, deleted_at: null },
    include: {
      _count: {
        select: { patient_insurances: { where: { deleted_at: null } } },
      },
    },
    orderBy: { created_at: "desc" },
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    contact_email: p.contact_email,
    contact_phone: p.contact_phone,
    deduction_type: p.deduction_type,
    deduction_value: Number(p.deduction_value),
    consultation_deduction_type: p.consultation_deduction_type ?? null,
    consultation_deduction_value:
      p.consultation_deduction_value !== null &&
      p.consultation_deduction_value !== undefined
        ? Number(p.consultation_deduction_value)
        : null,
    lab_deduction_type: p.lab_deduction_type ?? null,
    lab_deduction_value:
      p.lab_deduction_value !== null && p.lab_deduction_value !== undefined
        ? Number(p.lab_deduction_value)
        : null,
    pharmacy_deduction_type: p.pharmacy_deduction_type ?? null,
    pharmacy_deduction_value:
      p.pharmacy_deduction_value !== null &&
      p.pharmacy_deduction_value !== undefined
        ? Number(p.pharmacy_deduction_value)
        : null,
    covered_visits: p.covered_visits,
    is_active: p.is_active,
    created_at: p.created_at.toISOString(),
    patients_count: p._count.patient_insurances,
  }));
}

export async function createInsuranceProvider(data: InsuranceProviderData) {
  try {
    const tenant = await requireInsuranceManager();
    const result = insuranceProviderSchema.safeParse(data);
    if (!result.success) return { error: firstIssue(result.error) };
    const parsed = result.data;

    const consultation = normalizeOptionalCategoryRule(
      parsed.consultation_deduction_type,
      parsed.consultation_deduction_value,
      parsed.deduction_type,
    );
    const lab = normalizeOptionalCategoryRule(
      parsed.lab_deduction_type,
      parsed.lab_deduction_value,
      parsed.deduction_type,
    );
    const pharmacy = normalizeOptionalCategoryRule(
      parsed.pharmacy_deduction_type,
      parsed.pharmacy_deduction_value,
      parsed.deduction_type,
    );

    await prisma.insurance_providers.create({
      data: {
        id: randomUUID(),
        clinic_id: tenant.clinicId,
        name: parsed.name,
        contact_email: parsed.contact_email || null,
        contact_phone: parsed.contact_phone || null,
        deduction_type: parsed.deduction_type,
        deduction_value: parsed.deduction_value,
        consultation_deduction_type: consultation.type,
        consultation_deduction_value: consultation.value,
        lab_deduction_type: lab.type,
        lab_deduction_value: lab.value,
        pharmacy_deduction_type: pharmacy.type,
        pharmacy_deduction_value: pharmacy.value,
        covered_visits: parsed.covered_visits ?? null,
        is_active: parsed.is_active,
      },
    });

    revalidateInsurancePages();
    return { success: true as const };
  } catch (error) {
    return {
      error: toErrorMessage(error, "Failed to create insurance company."),
    };
  }
}

export async function updateInsuranceProvider(
  id: string,
  data: InsuranceProviderData,
) {
  try {
    const tenant = await requireInsuranceManager();
    const result = insuranceProviderSchema.safeParse(data);
    if (!result.success) return { error: firstIssue(result.error) };
    const parsed = result.data;

    const consultation = normalizeOptionalCategoryRule(
      parsed.consultation_deduction_type,
      parsed.consultation_deduction_value,
      parsed.deduction_type,
    );
    const lab = normalizeOptionalCategoryRule(
      parsed.lab_deduction_type,
      parsed.lab_deduction_value,
      parsed.deduction_type,
    );
    const pharmacy = normalizeOptionalCategoryRule(
      parsed.pharmacy_deduction_type,
      parsed.pharmacy_deduction_value,
      parsed.deduction_type,
    );

    const { count } = await prisma.insurance_providers.updateMany({
      where: { id, clinic_id: tenant.clinicId, deleted_at: null },
      data: {
        name: parsed.name,
        contact_email: parsed.contact_email || null,
        contact_phone: parsed.contact_phone || null,
        deduction_type: parsed.deduction_type,
        deduction_value: parsed.deduction_value,
        consultation_deduction_type: consultation.type,
        consultation_deduction_value: consultation.value,
        lab_deduction_type: lab.type,
        lab_deduction_value: lab.value,
        pharmacy_deduction_type: pharmacy.type,
        pharmacy_deduction_value: pharmacy.value,
        covered_visits: parsed.covered_visits ?? null,
        is_active: parsed.is_active,
      },
    });
    if (count === 0) return { error: "Insurance company not found." };

    revalidateInsurancePages();
    return { success: true as const };
  } catch (error) {
    return {
      error: toErrorMessage(error, "Failed to update insurance company."),
    };
  }
}

export async function deleteInsuranceProvider(id: string) {
  try {
    const tenant = await requireInsuranceManager();

    const { count } = await prisma.insurance_providers.updateMany({
      where: { id, clinic_id: tenant.clinicId, deleted_at: null },
      data: { deleted_at: new Date(), is_active: false },
    });
    if (count === 0) return { error: "Insurance company not found." };

    revalidateInsurancePages();
    return { success: true as const };
  } catch (error) {
    return {
      error: toErrorMessage(error, "Failed to delete insurance company."),
    };
  }
}

// ---------------------------------------------------------------------------
// Patient policies
// ---------------------------------------------------------------------------

export async function getPatientInsurances(
  patientId: string,
): Promise<PatientInsuranceRow[]> {
  const tenant = await requireInsuranceManager();

  const rows = await prisma.patient_insurances.findMany({
    where: {
      patient_id: patientId,
      clinic_id: tenant.clinicId,
      deleted_at: null,
    },
    include: { insurance_providers: true },
    orderBy: { created_at: "desc" },
  });

  return rows.map((pi) => mapPolicyRow(pi));
}

export async function assignPatientInsurance(data: AssignPatientInsuranceData) {
  try {
    const tenant = await requireInsuranceManager();
    const result = assignPatientInsuranceSchema.safeParse(data);
    if (!result.success) return { error: firstIssue(result.error) };
    const parsed = result.data;

    const [patient, provider] = await Promise.all([
      prisma.patients.findFirst({
        where: { id: parsed.patient_id, clinic_id: tenant.clinicId },
        select: { id: true },
      }),
      prisma.insurance_providers.findFirst({
        where: {
          id: parsed.provider_id,
          clinic_id: tenant.clinicId,
          deleted_at: null,
        },
        select: { id: true },
      }),
    ]);
    if (!patient) return { error: "Patient not found." };
    if (!provider) return { error: "Insurance company not found." };

    const existing = await prisma.patient_insurances.findFirst({
      where: {
        patient_id: parsed.patient_id,
        provider_id: parsed.provider_id,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (existing) {
      return { error: "Patient already has a policy with this company." };
    }

    await prisma.patient_insurances.create({
      data: {
        id: randomUUID(),
        clinic_id: tenant.clinicId,
        patient_id: parsed.patient_id,
        provider_id: parsed.provider_id,
        policy_number: parsed.policy_number || null,
        valid_from: parsed.valid_from ? new Date(parsed.valid_from) : null,
        valid_to: parsed.valid_to ? new Date(parsed.valid_to) : null,
      },
    });

    revalidatePath("/admin/patients");
    return { success: true as const };
  } catch (error) {
    return { error: toErrorMessage(error, "Failed to assign insurance.") };
  }
}

export async function updatePatientInsurance(
  id: string,
  data: AssignPatientInsuranceData,
) {
  try {
    const tenant = await requireInsuranceManager();
    const result = assignPatientInsuranceSchema.safeParse(data);
    if (!result.success) return { error: firstIssue(result.error) };
    const parsed = result.data;

    const { count } = await prisma.patient_insurances.updateMany({
      where: { id, clinic_id: tenant.clinicId, deleted_at: null },
      data: {
        policy_number: parsed.policy_number || null,
        valid_from: parsed.valid_from ? new Date(parsed.valid_from) : null,
        valid_to: parsed.valid_to ? new Date(parsed.valid_to) : null,
      },
    });
    if (count === 0) return { error: "Policy not found." };

    revalidatePath("/admin/patients");
    return { success: true as const };
  } catch (error) {
    return { error: toErrorMessage(error, "Failed to update insurance.") };
  }
}

export async function removePatientInsurance(id: string) {
  try {
    const tenant = await requireInsuranceManager();

    const { count } = await prisma.patient_insurances.updateMany({
      where: { id, clinic_id: tenant.clinicId, deleted_at: null },
      data: { deleted_at: new Date(), is_active: false },
    });
    if (count === 0) return { error: "Policy not found." };

    revalidatePath("/admin/patients");
    return { success: true as const };
  } catch (error) {
    return { error: toErrorMessage(error, "Failed to remove insurance.") };
  }
}

// ---------------------------------------------------------------------------
// Shared mapping
// ---------------------------------------------------------------------------

type PolicyWithProvider = {
  id: string;
  provider_id: string;
  policy_number: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
  visits_used: number;
  is_active: boolean;
  insurance_providers: {
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
    deduction_type: "fixed" | "percentage";
    deduction_value: unknown;
    consultation_deduction_type?: "fixed" | "percentage" | null;
    consultation_deduction_value?: unknown;
    lab_deduction_type?: "fixed" | "percentage" | null;
    lab_deduction_value?: unknown;
    pharmacy_deduction_type?: "fixed" | "percentage" | null;
    pharmacy_deduction_value?: unknown;
    covered_visits: number | null;
    is_active: boolean;
    deleted_at: Date | null;
  };
};

function mapPolicyRow(pi: PolicyWithProvider): PatientInsuranceRow {
  const provider = pi.insurance_providers;
  const providerActive = provider.is_active && provider.deleted_at === null;

  return {
    id: pi.id,
    provider_id: pi.provider_id,
    provider_name: provider.name,
    contact_email: provider.contact_email,
    contact_phone: provider.contact_phone,
    policy_number: pi.policy_number,
    valid_from: pi.valid_from ? pi.valid_from.toISOString() : null,
    valid_to: pi.valid_to ? pi.valid_to.toISOString() : null,
    deduction_type: provider.deduction_type,
    deduction_value: Number(provider.deduction_value),
    consultation_deduction_type: provider.consultation_deduction_type ?? null,
    consultation_deduction_value:
      provider.consultation_deduction_value !== null &&
      provider.consultation_deduction_value !== undefined
        ? Number(provider.consultation_deduction_value)
        : null,
    lab_deduction_type: provider.lab_deduction_type ?? null,
    lab_deduction_value:
      provider.lab_deduction_value !== null &&
      provider.lab_deduction_value !== undefined
        ? Number(provider.lab_deduction_value)
        : null,
    pharmacy_deduction_type: provider.pharmacy_deduction_type ?? null,
    pharmacy_deduction_value:
      provider.pharmacy_deduction_value !== null &&
      provider.pharmacy_deduction_value !== undefined
        ? Number(provider.pharmacy_deduction_value)
        : null,
    covered_visits: provider.covered_visits,
    visits_used: pi.visits_used,
    remaining_visits: remainingVisits(provider.covered_visits, pi.visits_used),
    is_active: pi.is_active,
    provider_is_active: providerActive,
    is_eligible: isPolicyEligible({
      is_active: pi.is_active,
      valid_from: pi.valid_from,
      valid_to: pi.valid_to,
      visits_used: pi.visits_used,
      provider: {
        is_active: providerActive,
        covered_visits: provider.covered_visits,
      },
    }),
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}
