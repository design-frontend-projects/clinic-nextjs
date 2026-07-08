"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import { specialtySchema, type SpecialtyFormData } from "@/types/specialty.types";

/**
 * Fetch all specialties in the catalog (app-owner view).
 */
export async function getSpecialties() {
  await requireAppOwner();

  return prisma.specialties.findMany({
    include: {
      _count: { select: { doctor_specialties: true } },
    },
    orderBy: [{ display_order: "asc" }, { name: "asc" }],
  });
}

/**
 * Get a single specialty by ID.
 */
export async function getSpecialty(id: string) {
  await requireAppOwner();

  return prisma.specialties.findUnique({ where: { id } });
}

/**
 * Create or update a specialty.
 */
export async function upsertSpecialty(data: SpecialtyFormData) {
  const admin = await requireAppOwner();

  const parsed = specialtySchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Invalid specialty data",
    };
  }

  const { id, ...specialtyData } = parsed.data;

  if (id) {
    const updated = await prisma.specialties.update({
      where: { id },
      data: { ...specialtyData, updated_by: admin.id },
    });
    revalidatePath("/app-owner/specialties");
    return { success: true, specialty: updated };
  }

  const created = await prisma.specialties.create({
    data: { ...specialtyData, created_by: admin.id },
  });
  revalidatePath("/app-owner/specialties");
  return { success: true, specialty: created };
}

/**
 * Enable/disable a specialty (soft toggle — keeps existing doctor links intact).
 */
export async function toggleSpecialtyActive(id: string, isActive: boolean) {
  const admin = await requireAppOwner();

  await prisma.specialties.update({
    where: { id },
    data: { is_active: isActive, updated_by: admin.id },
  });

  revalidatePath("/app-owner/specialties");
  return { success: true };
}
