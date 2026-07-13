"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import {
  medicationSchema,
  type MedicationFormData,
  type ClinicOption,
} from "@/types/medication.types";

const LIST_PATH = "/app-owner/medications";

/**
 * Clinics the owner can manage medications for (dropdown source).
 */
export async function getManagedClinics(): Promise<ClinicOption[]> {
  await requireAppOwner();

  return prisma.clinics.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * All medications for a single clinic (active first, then alphabetical).
 */
export async function getMedications(clinicId: string) {
  await requireAppOwner();

  const medications = await prisma.medications.findMany({
    where: { clinic_id: clinicId },
    orderBy: [{ is_active: "desc" }, { generic_name: "asc" }],
  });

  return medications.map((medication) => ({
    ...medication,
    price: medication.price ? Number(medication.price) : null,
  }));
}

/**
 * Single medication by id.
 */
export async function getMedication(id: string) {
  await requireAppOwner();

  const medication = await prisma.medications.findUnique({ where: { id } });
  if (!medication) return null;

  return {
    ...medication,
    price: medication.price ? Number(medication.price) : null,
  };
}

/**
 * Create or update a medication for a clinic.
 * `medications.id` has no DB default, so a UUID is generated on create.
 */
export async function upsertMedication(data: MedicationFormData) {
  await requireAppOwner();

  const parsed = medicationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid medication data" };
  }

  const { id, price, ...rest } = parsed.data;
  const writeData = {
    ...rest,
    price: price ?? null,
  };

  try {
    if (id) {
      const updated = await prisma.medications.update({
        where: { id },
        data: writeData,
      });
      revalidatePath(LIST_PATH);
      return {
        success: true,
        medication: {
          ...updated,
          price: updated.price ? Number(updated.price) : null,
        },
      };
    }

    const created = await prisma.medications.create({
      data: { id: crypto.randomUUID(), ...writeData },
    });
    revalidatePath(LIST_PATH);
    return {
      success: true,
      medication: {
        ...created,
        price: created.price ? Number(created.price) : null,
      },
    };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        error:
          "A medication with this name and strength already exists for this clinic.",
      };
    }
    throw error;
  }
}

/**
 * Soft enable/disable a medication (keeps prescription/stock references intact).
 */
export async function toggleMedicationActive(id: string, isActive: boolean) {
  await requireAppOwner();

  await prisma.medications.update({
    where: { id },
    data: { is_active: isActive },
  });

  revalidatePath(LIST_PATH);
  return { success: true };
}
