"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
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

const WRITE_ROLES = ["doctor", "admin"] as const;

type ActionResult<T> = { success: true; data: T } | { error: string };

function isWriteRole(role: string | null | undefined): boolean {
  return WRITE_ROLES.includes(role as (typeof WRITE_ROLES)[number]);
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
      prescription_items: true,
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
    include: { prescription_items: true },
  });
}

/** Search the clinic medications catalog for the hybrid combobox. */
export async function searchMedications(query: string) {
  const tenant = await requireTenantInfo();

  if (!query || query.trim().length < 2) return [];

  return prisma.medications.findMany({
    where: {
      clinic_id: tenant.clinicId,
      is_active: true,
      OR: [
        { generic_name: { contains: query, mode: "insensitive" } },
        { brand_name: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      generic_name: true,
      brand_name: true,
      strength: true,
      form: true,
      route: true,
    },
    take: 10,
  });
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
      prescription_items: { create: toItemCreateData(tenant.clinicId, items) },
    },
    select: { id: true },
  });

  revalidatePath("/doctor/prescriptions");
  revalidatePath(`/doctor/patients/${patient_id}`);
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
    select: { id: true },
  });
  if (!existing) return { error: "Prescription not found" };

  const { patient_id, diagnosis, notes, status, items } = parsed.data;

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
          create: toItemCreateData(tenant.clinicId, items),
        },
      },
    }),
  ]);

  revalidatePath("/doctor/prescriptions");
  revalidatePath(`/doctor/patients/${patient_id}`);
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
  return { success: true, data: { id } };
}
