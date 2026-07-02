"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";

/**
 * Fetch all global settings
 */
export async function getGlobalSettings() {
  await requireAppOwner();

  const settings = await prisma.global_settings.findMany({
    orderBy: { category: "asc" },
  });

  // Group by category
  return settings.reduce((acc: any, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {});
}

/**
 * Update multiple global settings
 */
export async function updateGlobalSettings(settingsToUpdate: Array<{ key: string; value: any; category: string; is_public?: boolean }>) {
  const admin = await requireAppOwner();

  for (const setting of settingsToUpdate) {
    await prisma.global_settings.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        updated_by: admin.id,
      },
      create: {
        key: setting.key,
        category: setting.category,
        value: setting.value,
        is_public: setting.is_public ?? false,
      },
    });
  }

  revalidatePath("/app-owner/settings");
  return { success: true };
}
