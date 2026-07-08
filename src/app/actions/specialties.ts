"use server";

import { prisma } from "@/lib/prisma";
import { getSupabaseSession } from "@/lib/auth";
import type { ActiveSpecialty } from "@/types/specialty.types";

/**
 * Active specialties for pickers (e.g. doctor-owner onboarding). The catalog is
 * global, so this only requires an authenticated session — no tenant scope.
 */
export async function getActiveSpecialties(): Promise<ActiveSpecialty[]> {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return [];

  return prisma.specialties.findMany({
    where: { is_active: true },
    select: { id: true, name: true, name_ar: true },
    orderBy: [{ display_order: "asc" }, { name: "asc" }],
  });
}
