"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  globalSettingsUpdateSchema,
  type GlobalSettingUpdate,
} from "@/types/subscription.types";
import { settingsService } from "@/features/settings/services/settings.service";
import { lookupService } from "@/features/settings/services/lookup.service";
import { templateService } from "@/features/settings/services/template.service";
import { featureService } from "@/features/settings/services/feature.service";
import { settingsCacheService } from "@/features/settings/services/cache.service";
import { SettingsRepository } from "@/features/settings/repositories/settings.repository";
import {
  DefinitionUpsertSchema,
  FeatureFlagUpsertSchema,
  LookupValueUpsertSchema,
  TemplateUpsertSchema,
  TenantFeatureOverrideSchema,
} from "@/features/settings/domain/dtos";

const settingsRepo = new SettingsRepository();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Fetch all global settings
 */
export async function getGlobalSettings() {
  await requireAppOwner();

  const settings = await prisma.global_settings.findMany({
    orderBy: { category: "asc" },
  });

  // Group by category
  return settings.reduce((acc: Record<string, typeof settings>, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {});
}

/**
 * Update multiple global settings. Every key must have a matching
 * setting_definitions row (allowed_scopes containing 'platform'); values are
 * validated against the definition and the change lands in settings_history.
 */
export async function updateGlobalSettings(settingsToUpdate: GlobalSettingUpdate[]) {
  try {
    const admin = await requireAppOwner();

    const parsed = globalSettingsUpdateSchema.safeParse(settingsToUpdate);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid settings data" };
    }

    await settingsService.updatePlatformSettings(
      { id: admin.id, email: admin.email ?? null },
      parsed.data.map((setting) => ({ key: setting.key, value: setting.value }))
    );

    revalidatePath("/app-owner/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Platform settings resolved against their definitions (definition metadata +
 * current platform value + default) — what the editor UI renders.
 */
export async function getPlatformSettingsOverview() {
  try {
    await requireAppOwner();
    const [definitions, values] = await Promise.all([
      settingsService.getDefinitions(),
      prisma.global_settings.findMany(),
    ]);
    const valueByKey = new Map(values.map((row) => [row.key, row.value]));
    const data = definitions
      .filter((definition) => definition.allowed_scopes.includes("platform"))
      .map((definition) => ({
        ...definition,
        current_value: valueByKey.has(definition.key) ? valueByKey.get(definition.key) : definition.default_value,
        is_set: valueByKey.has(definition.key),
      }));
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Setting definitions catalog
// ---------------------------------------------------------------------------
export async function getSettingDefinitions() {
  try {
    await requireAppOwner();
    const data = await settingsService.getDefinitions();
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function upsertSettingDefinition(input: unknown) {
  try {
    const admin = await requireAppOwner();
    const parsed = DefinitionUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid definition" };

    const { key, module, category, value_type, default_value, validation, allowed_scopes, is_sensitive, is_public, description, display_order } = parsed.data;
    await settingsRepo.upsertDefinition(
      {
        key,
        module,
        category,
        value_type,
        allowed_scopes,
        is_sensitive,
        is_public,
        display_order,
        default_value: (default_value ?? null) as Prisma.InputJsonValue,
        validation: (validation ?? null) as Prisma.InputJsonValue | null,
        description: description ?? null,
      },
      admin.id
    );
    await settingsCacheService.invalidateDefinitions();
    revalidatePath("/app-owner/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Feature flags + per-tenant overrides
// ---------------------------------------------------------------------------
export async function getFeatureFlags() {
  try {
    await requireAppOwner();
    const data = await settingsRepo.findFeatureFlags();
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function upsertFeatureFlag(input: unknown) {
  try {
    const admin = await requireAppOwner();
    const parsed = FeatureFlagUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid feature flag" };

    const { key, name, name_ar, description, default_enabled, kill_switch, is_beta } = parsed.data;
    await settingsRepo.upsertFeatureFlag(
      {
        key,
        name,
        name_ar: name_ar ?? null,
        description: description ?? null,
        default_enabled,
        kill_switch,
        is_beta,
      },
      admin.id
    );
    // Tenant feature caches expire on their own TTL (120s); flag edits do not
    // need to be instantaneous across all tenants.
    revalidatePath("/app-owner/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function setTenantFeatureOverride(input: unknown) {
  try {
    const admin = await requireAppOwner();
    const parsed = TenantFeatureOverrideSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid override" };

    const { tenantId, featureKey, isEnabled, reason, expiresAt } = parsed.data;
    await settingsRepo.upsertTenantFeatureOverride(
      tenantId,
      featureKey,
      {
        isEnabled,
        reason: reason ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      admin.id
    );
    await featureService.invalidate(tenantId);
    revalidatePath("/app-owner/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Global lookup values + global notification templates
// ---------------------------------------------------------------------------
export async function upsertGlobalLookupValue(input: unknown) {
  try {
    const admin = await requireAppOwner();
    const parsed = LookupValueUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid lookup value" };

    await lookupService.upsertGlobalValue(parsed.data, admin.id);
    revalidatePath("/app-owner/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function upsertGlobalTemplate(input: unknown) {
  try {
    const admin = await requireAppOwner();
    const parsed = TemplateUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid template" };

    await templateService.upsertGlobalTemplate(parsed.data, admin.id);
    revalidatePath("/app-owner/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}
