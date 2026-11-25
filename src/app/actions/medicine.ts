"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import {
  clinicMedicineSchema,
  stopMedicineSchema,
  type ClinicMedicineCounts,
  type ClinicMedicineFormData,
  type ClinicMedicineRecord,
  type StopMedicineInput,
} from "@/types/medication.types";

const MEDICINE_ROLES = ["doctor", "owner"] as const;

type ActionResult<T> = { success: true; data: T } | { error: string };

function isMedicineRole(role: string | null | undefined): boolean {
  return MEDICINE_ROLES.includes(role as (typeof MEDICINE_ROLES)[number]);
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeMedicine(row: {
  id: string;
  clinic_id: string;
  generic_name: string;
  brand_name: string | null;
  category: string | null;
  strength: string | null;
  form: string | null;
  route: string | null;
  default_dosage: string | null;
  default_frequency: string | null;
  default_duration: string | null;
  default_quantity: number | null;
  default_instructions: string | null;
  manufacturer: string | null;
  barcode: string | null;
  code: string | null;
  code_system: string | null;
  price: Prisma.Decimal | number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  stopped_at: Date | null;
  stopped_by: string | null;
  stop_reason: string | null;
  creator?: { full_name: string | null } | null;
  stopper?: { full_name: string | null } | null;
}): ClinicMedicineRecord {
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    generic_name: row.generic_name,
    brand_name: row.brand_name,
    category: row.category,
    strength: row.strength,
    form: row.form,
    route: row.route,
    default_dosage: row.default_dosage,
    default_frequency: row.default_frequency,
    default_duration: row.default_duration,
    default_quantity: row.default_quantity,
    default_instructions: row.default_instructions,
    manufacturer: row.manufacturer,
    barcode: row.barcode,
    code: row.code,
    code_system: row.code_system,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : null,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    stopped_at: row.stopped_at,
    stopped_by: row.stopped_by,
    stop_reason: row.stop_reason,
    created_by_name: row.creator?.full_name ?? null,
    stopped_by_name: row.stopper?.full_name ?? null,
  };
}

function revalidateMedicinePaths() {
  revalidatePath("/doctor/medicines");
  revalidatePath("/admin/medicines");
  revalidatePath("/doctor/prescriptions");
  revalidatePath("/admin/prescriptions");
}

const MEDICINE_INCLUDE = {
  creator: { select: { full_name: true } },
  stopper: { select: { full_name: true } },
} as const;

export interface ClinicMedicinesPayload {
  medicines: ClinicMedicineRecord[];
  counts: ClinicMedicineCounts;
}

/**
 * List clinic medicines with counts. Strictly gated to `doctor` and `owner`.
 */
export async function getClinicMedicines(params?: {
  status?: "all" | "active" | "stopped";
  search?: string;
  category?: string;
}): Promise<ActionResult<ClinicMedicinesPayload>> {
  const tenant = await requireTenantInfo();

  if (!isMedicineRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const allRows = await prisma.medications.findMany({
    where: { clinic_id: tenant.clinicId },
    include: MEDICINE_INCLUDE,
    orderBy: [{ is_active: "desc" }, { generic_name: "asc" }],
  });

  const serialized = allRows.map(serializeMedicine);
  const activeCount = serialized.filter((m) => m.is_active).length;
  const counts: ClinicMedicineCounts = {
    total: serialized.length,
    active: activeCount,
    stopped: serialized.length - activeCount,
  };

  let filtered = serialized;

  if (params?.status === "active") {
    filtered = filtered.filter((m) => m.is_active);
  } else if (params?.status === "stopped") {
    filtered = filtered.filter((m) => !m.is_active);
  }

  if (params?.category && params.category !== "all") {
    filtered = filtered.filter((m) => m.category === params.category);
  }

  const q = params?.search?.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((m) =>
      [m.generic_name, m.brand_name, m.strength, m.category, m.form]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }

  return {
    success: true,
    data: {
      medicines: filtered,
      counts,
    },
  };
}

/**
 * Create a new medicine in the clinic catalog. Strictly `doctor` or `owner`.
 */
export async function createClinicMedicine(
  data: ClinicMedicineFormData,
): Promise<ActionResult<ClinicMedicineRecord>> {
  const tenant = await requireTenantInfo();

  if (!isMedicineRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = clinicMedicineSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid medicine data" };
  }

  const d = parsed.data;

  try {
    const created = await prisma.medications.create({
      data: {
        id: crypto.randomUUID(),
        clinic_id: tenant.clinicId,
        generic_name: d.generic_name,
        brand_name: emptyToNull(d.brand_name),
        category: emptyToNull(d.category),
        strength: emptyToNull(d.strength),
        form: emptyToNull(d.form),
        route: emptyToNull(d.route),
        default_dosage: emptyToNull(d.default_dosage),
        default_frequency: emptyToNull(d.default_frequency),
        default_duration: emptyToNull(d.default_duration),
        default_quantity: d.default_quantity ?? null,
        default_instructions: emptyToNull(d.default_instructions),
        manufacturer: emptyToNull(d.manufacturer),
        price: d.price ?? null,
        barcode: emptyToNull(d.barcode),
        code: emptyToNull(d.code),
        code_system: emptyToNull(d.code_system),
        is_active: true,
        created_by: tenant.profileId,
        updated_by: tenant.profileId,
      },
      include: MEDICINE_INCLUDE,
    });

    revalidateMedicinePaths();
    return { success: true, data: serializeMedicine(created) };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        error:
          "A medicine with this generic name and strength already exists in your clinic.",
      };
    }
    throw error;
  }
}

/**
 * Update an existing clinic medicine. Strictly `doctor` or `owner`.
 */
export async function updateClinicMedicine(
  id: string,
  data: ClinicMedicineFormData,
): Promise<ActionResult<ClinicMedicineRecord>> {
  const tenant = await requireTenantInfo();

  if (!isMedicineRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = clinicMedicineSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid medicine data" };
  }

  const existing = await prisma.medications.findFirst({
    where: { id, clinic_id: tenant.clinicId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Medicine not found" };
  }

  const d = parsed.data;

  try {
    const updated = await prisma.medications.update({
      where: { id },
      data: {
        generic_name: d.generic_name,
        brand_name: emptyToNull(d.brand_name),
        category: emptyToNull(d.category),
        strength: emptyToNull(d.strength),
        form: emptyToNull(d.form),
        route: emptyToNull(d.route),
        default_dosage: emptyToNull(d.default_dosage),
        default_frequency: emptyToNull(d.default_frequency),
        default_duration: emptyToNull(d.default_duration),
        default_quantity: d.default_quantity ?? null,
        default_instructions: emptyToNull(d.default_instructions),
        manufacturer: emptyToNull(d.manufacturer),
        price: d.price ?? null,
        barcode: emptyToNull(d.barcode),
        code: emptyToNull(d.code),
        code_system: emptyToNull(d.code_system),
        updated_by: tenant.profileId,
      },
      include: MEDICINE_INCLUDE,
    });

    revalidateMedicinePaths();
    return { success: true, data: serializeMedicine(updated) };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        error:
          "A medicine with this generic name and strength already exists in your clinic.",
      };
    }
    throw error;
  }
}

/**
 * Stop a clinic medicine (`is_active = false`), recording audit fields and
 * optional reason. Strictly `doctor` or `owner`.
 */
export async function stopClinicMedicine(
  input: StopMedicineInput,
): Promise<ActionResult<ClinicMedicineRecord>> {
  const tenant = await requireTenantInfo();

  if (!isMedicineRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = stopMedicineSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { id, stop_reason } = parsed.data;

  const existing = await prisma.medications.findFirst({
    where: { id, clinic_id: tenant.clinicId },
    select: { id: true, is_active: true },
  });
  if (!existing) {
    return { error: "Medicine not found" };
  }
  if (!existing.is_active) {
    return { error: "Medicine is already stopped" };
  }

  const updated = await prisma.medications.update({
    where: { id },
    data: {
      is_active: false,
      stopped_at: new Date(),
      stopped_by: tenant.profileId,
      stop_reason: emptyToNull(stop_reason),
      updated_by: tenant.profileId,
    },
    include: MEDICINE_INCLUDE,
  });

  revalidateMedicinePaths();
  return { success: true, data: serializeMedicine(updated) };
}

/**
 * Resume a stopped clinic medicine (`is_active = true`), clearing stop metadata.
 * Strictly `doctor` or `owner`.
 */
export async function resumeClinicMedicine(
  id: string,
): Promise<ActionResult<ClinicMedicineRecord>> {
  const tenant = await requireTenantInfo();

  if (!isMedicineRole(tenant.role)) {
    return { error: "Unauthorized" };
  }

  const existing = await prisma.medications.findFirst({
    where: { id, clinic_id: tenant.clinicId },
    select: { id: true, is_active: true },
  });
  if (!existing) {
    return { error: "Medicine not found" };
  }
  if (existing.is_active) {
    return { error: "Medicine is already active" };
  }

  const updated = await prisma.medications.update({
    where: { id },
    data: {
      is_active: true,
      stopped_at: null,
      stopped_by: null,
      stop_reason: null,
      updated_by: tenant.profileId,
    },
    include: MEDICINE_INCLUDE,
  });

  revalidateMedicinePaths();
  return { success: true, data: serializeMedicine(updated) };
}
