"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  globalSettingsUpdateSchema,
  type GlobalSettingUpdate,
} from "@/types/subscription.types";

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
export async function updateGlobalSettings(settingsToUpdate: GlobalSettingUpdate[]) {
  const admin = await requireAppOwner();

  const parsed = globalSettingsUpdateSchema.safeParse(settingsToUpdate);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid settings data" };
  }

  for (const setting of parsed.data) {
    const value = setting.value as Prisma.InputJsonValue;
    await prisma.global_settings.upsert({
      where: { key: setting.key },
      update: {
        value,
        updated_by: admin.id,
      },
      create: {
        key: setting.key,
        category: setting.category,
        value,
        is_public: setting.is_public ?? false,
      },
    });
  }

  revalidatePath("/app-owner/settings");
  return { success: true };
}
