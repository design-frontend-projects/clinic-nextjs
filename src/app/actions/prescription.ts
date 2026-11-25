"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  formatMedicineLabel,
  type CatalogMedicineOption,
} from "@/types/medication.types";
import {
  prescriptionFormSchema,
  type PrescriptionFormData,
} from "@/types/prescription.types";

/**
 * Prescription CRUD for doctors. Every path resolves tenant context first and
 * scopes all queries by clinic_id (the multi-tenant invariant). Writes gate on
 * the doctor/admin role (matching doctor.ts + the doctor layout guard) and
 * validate with Zod safeParse, returning an { error } / { success } envelope.
 */

const WRITE_ROLES = ["doctor", "admin", "owner"] as const;
const QUICK_ADD_ROLES = ["doctor", "owner"] as const;

type ActionResult<T> = { success: true; data: T } | { error: string };

function isWriteRole(role: string | null | undefined): boolean {
  return WRITE_ROLES.includes(role as (typeof WRITE_ROLES)[number]);
}

function isQuickAddRole(role: string | null | undefined): boolean {
  return QUICK_ADD_ROLES.includes(role as (typeof QUICK_ADD_ROLES)[number]);
}

/** Map validated form items to Prisma prescription_items create input. */
function toItemCreateData(
  clinicId: string,
  items: PrescriptionFormData["items"],
) {
  return items.map((item) => ({
    clinic_id: clinicId,
    medication_id: item.medication_id ?? null,
    medication_name: item.medication_name,
    dosage: item.dosage || null,
    frequency: item.frequency || null,
    duration: item.duration || null,
    route: item.route || null,
    quantity: item.quantity ?? null,
    instructions: item.instructions || null,
  }));
}

/** List prescriptions for the clinic, optionally scoped to one patient. */
export async function getPrescriptions(patientId?: string) {
  const tenant = await requireTenantInfo();

  return prisma.prescriptions.findMany({
    where: {
      clinic_id: tenant.clinicId,
      ...(patientId ? { patient_id: patientId } : {}),
    },
    include: {
      prescription_items: {
        include: {
          medications: { select: { is_active: true } },
        },
      },
      patients: { select: { id: true, first_name: true, last_name: true } },
      profiles: { select: { full_name: true } },
    },
    orderBy: { issued_at: "desc" },
  });
}

/** Fetch a single prescription (with items) for edit prefill. */
export async function getPrescription(id: string) {
  const tenant = await requireTenantInfo();

  return prisma.prescriptions.findFirst({
    where: { id, clinic_id: tenant.clinicId },
    include: {
      prescription_items: {
        include: {
          medications: { select: { is_active: true } },
        },
      },
    },
  });
}

const CATALOG_SELECT = {
  id: true,
  generic_name: true,
  brand_name: true,
  category: true,
  strength: true,
  form: true,
  route: true,
  default_dosage: true,
  default_frequency: true,
  default_duration: true,
  default_quantity: true,
  default_instructions: true,
} as const;

export interface PrescriptionCatalogResult {
  medicines: CatalogMedicineOption[];
  canQuickAdd: boolean;
}

/**
 * Load active clinic medicines (immediately browsable even when query is empty)
 * along with prescribing defaults and whether the caller can quick-add.
 */
export async function getPrescriptionCatalog(
  query = "",
): Promise<PrescriptionCatalogResult> {
  const tenant = await requireTenantInfo();
  const trimmed = query.trim();

  const medicines = await prisma.medications.findMany({
    where: {
      clinic_id: tenant.clinicId,
      is_active: true,
      ...(trimmed.length > 0
        ? {
            OR: [
              { generic_name: { contains: trimmed, mode: "insensitive" } },
              { brand_name: { contains: trimmed, mode: "insensitive" } },
              { strength: { contains: trimmed, mode: "insensitive" } },
              { category: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: CATALOG_SELECT,
    orderBy: [{ generic_name: "asc" }],
    take: 50,
  });

  return {
    medicines,
    canQuickAdd: isQuickAddRole(tenant.role),
  };
}

/** Search active clinic medications for the catalog combobox. */
export async function searchMedications(
  query = "",
): Promise<CatalogMedicineOption[]> {
  const { medicines } = await getPrescriptionCatalog(query);
  return medicines;
}

export async function createPrescription(
  data: PrescriptionFormData,
): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenantInfo();

  if (!isWriteRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = prescriptionFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid data" };
  }

  const { patient_id, diagnosis, notes, status, items } = parsed.data;

  // Catalog-only enforcement: every prescribed item must reference an active
  // medicine in this clinic's catalog.
  if (items.some((item) => !item.medication_id)) {
    return { error: "Please select a medicine from the catalog for every item" };
  }

  const uniqueMedIds = Array.from(
    new Set(items.map((item) => item.medication_id!)),
  );
  const activeMeds = await prisma.medications.findMany({
    where: {
      id: { in: uniqueMedIds },
      clinic_id: tenant.clinicId,
      is_active: true,
    },
    select: {
      id: true,
      generic_name: true,
      brand_name: true,
      strength: true,
    },
  });

  if (activeMeds.length !== uniqueMedIds.length) {
    return { error: "One or more selected medicines are unavailable or stopped" };
  }

  const medById = new Map(activeMeds.map((m) => [m.id, m]));
  const canonicalItems = items.map((item) => {
    const med = medById.get(item.medication_id!);
    return {
      ...item,
      medication_name: med ? formatMedicineLabel(med) : item.medication_name,
    };
  });

  // Guard: the patient must belong to this clinic.
  const patient = await prisma.patients.findFirst({
    where: { id: patient_id, clinic_id: tenant.clinicId },
    select: { id: true },
  });
  if (!patient) return { error: "Patient not found" };

  const prescription = await prisma.prescriptions.create({
    data: {
      clinic_id: tenant.clinicId,
      branch_id: tenant.branchId,
      patient_id,
      doctor_id: tenant.profileId,
      diagnosis: diagnosis || null,
      notes: notes || null,
      status,
      prescription_items: {
        create: toItemCreateData(tenant.clinicId, canonicalItems),
      },
    },
    select: { id: true },
  });

  revalidatePath("/doctor/prescriptions");
  revalidatePath(`/doctor/patients/${patient_id}`);
  revalidatePath("/admin/prescriptions");
  revalidatePath(`/admin/patients/${patient_id}`);
  return { success: true, data: prescription };
}

export async function updatePrescription(
  id: string,
  data: PrescriptionFormData,
): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenantInfo();

  if (!isWriteRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = prescriptionFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid data" };
  }

  const existing = await prisma.prescriptions.findFirst({
    where: { id, clinic_id: tenant.clinicId },
    include: {
      prescription_items: {
        select: { medication_id: true, medication_name: true },
      },
    },
  });
  if (!existing) return { error: "Prescription not found" };

  const { patient_id, diagnosis, notes, status, items } = parsed.data;

  // Preserve unchanged historical items (legacy free-text or medicines stopped
  // after this prescription was issued), while requiring any newly added or
  // changed item to come from active clinic medicines.
  const existingMedIds = new Set(
    existing.prescription_items
      .map((i) => i.medication_id)
      .filter((medId): medId is string => Boolean(medId)),
  );
  const existingLegacyNames = new Set(
    existing.prescription_items
      .filter((i) => !i.medication_id)
      .map((i) => i.medication_name),
  );

  const newMedIdsToValidate = new Set<string>();
  for (const item of items) {
    if (!item.medication_id) {
      if (!existingLegacyNames.has(item.medication_name)) {
        return {
          error: "Please select a medicine from the catalog for every item",
        };
      }
      continue;
    }

    if (!existingMedIds.has(item.medication_id)) {
      newMedIdsToValidate.add(item.medication_id);
    }
  }

  let validatedNewMeds = new Map<
    string,
    { id: string; generic_name: string; brand_name: string | null; strength: string | null }
  >();
  if (newMedIdsToValidate.size > 0) {
    const newIdList = Array.from(newMedIdsToValidate);
    const activeNewMeds = await prisma.medications.findMany({
      where: {
        id: { in: newIdList },
        clinic_id: tenant.clinicId,
        is_active: true,
      },
      select: {
        id: true,
        generic_name: true,
        brand_name: true,
        strength: true,
      },
    });
    if (activeNewMeds.length !== newIdList.length) {
      return {
        error: "One or more selected medicines are unavailable or stopped",
      };
    }
    validatedNewMeds = new Map(activeNewMeds.map((m) => [m.id, m]));
  }

  const canonicalItems = items.map((item) => {
    if (!item.medication_id) return item;
    const med = validatedNewMeds.get(item.medication_id);
    return med
      ? { ...item, medication_name: formatMedicineLabel(med) }
      : item;
  });

  // Replace items wholesale (delete then recreate) inside one transaction so a
  // failure never leaves a partially-updated prescription.
  await prisma.$transaction([
    prisma.prescription_items.deleteMany({
      where: { prescription_id: id, clinic_id: tenant.clinicId },
    }),
    prisma.prescriptions.update({
      where: { id },
      data: {
        patient_id,
        diagnosis: diagnosis || null,
        notes: notes || null,
        status,
        prescription_items: {
          create: toItemCreateData(tenant.clinicId, canonicalItems),
        },
      },
    }),
  ]);

  revalidatePath("/doctor/prescriptions");
  revalidatePath(`/doctor/patients/${patient_id}`);
  revalidatePath("/admin/prescriptions");
  revalidatePath(`/admin/patients/${patient_id}`);
  return { success: true, data: { id } };
}

export async function deletePrescription(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenantInfo();

  if (!isWriteRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const existing = await prisma.prescriptions.findFirst({
    where: { id, clinic_id: tenant.clinicId },
    select: { id: true, patient_id: true },
  });
  if (!existing) return { error: "Prescription not found" };

  // Soft delete: tombstone the header (reads filter deleted_at via the
  // soft-delete Prisma extension).
  await prisma.prescriptions.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  revalidatePath("/doctor/prescriptions");
  revalidatePath(`/doctor/patients/${existing.patient_id}`);
  revalidatePath("/admin/prescriptions");
  revalidatePath(`/admin/patients/${existing.patient_id}`);
  return { success: true, data: { id } };
}
