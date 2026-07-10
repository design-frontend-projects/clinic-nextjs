// src/features/settings/actions.ts
// Server-action API surface of the settings module (tenant + user scopes).
// Platform-scope actions live in src/app/actions/app-owner/settings.ts.
// Conventions: requireTenantInfo() first, requirePermission("settings.…"),
// Zod safeParse -> { error }, { data } / { success } returns, revalidatePath.
"use server";

import { revalidatePath } from "next/cache";
import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { auditService } from "@/features/rbac/services/audit.service";
import { settingsService } from "./services/settings.service";
import { lookupService } from "./services/lookup.service";
import { templateService } from "./services/template.service";
import { sequenceService } from "./services/sequence.service";
import { featureService } from "./services/feature.service";
import { SettingsRepository } from "./repositories/settings.repository";
import { secretStore, channelSecretName } from "./services/vault.service";
import {
  ChannelTestSchema,
  ChannelUpsertSchema,
  HistoryQuerySchema,
  LookupQuerySchema,
  LookupValueDeleteSchema,
  LookupValueUpsertSchema,
  RollbackSchema,
  SequencePreviewSchema,
  SequenceUpsertSchema,
  SettingsImportSchema,
  SettingsSearchSchema,
  SettingsUpdateSchema,
  TemplatePreviewSchema,
  TemplatesQuerySchema,
  TemplateUpsertSchema,
} from "./domain/dtos";
import { Prisma } from "@prisma/client";

const repo = new SettingsRepository();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function getActor() {
  const tenant = await requireTenantInfo();
  return {
    id: tenant.profileId,
    email: tenant.email ?? null,
    clinicId: tenant.clinicId,
  };
}

// ---------------------------------------------------------------------------
// Core tenant settings
// ---------------------------------------------------------------------------
export async function getTenantSettings(module?: string) {
  try {
    const actor = await getActor();
    await requirePermission("settings.core.read");
    const data = await settingsService.getResolvedSettings(actor.clinicId, actor.id, { module });
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function updateTenantSettings(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.core.manage");
    const parsed = SettingsUpdateSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid settings data" };

    await settingsService.updateTenantSettings(actor.clinicId, actor, parsed.data.updates);
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function searchSettings(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.core.read");
    const parsed = SettingsSearchSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid search query" };
    const data = await settingsService.searchSettings(actor.clinicId, actor.id, parsed.data.query);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// History / rollback / export / import
// ---------------------------------------------------------------------------
export async function getSettingsHistory(input: unknown = {}) {
  try {
    const actor = await getActor();
    await requirePermission("settings.history.read");
    const parsed = HistoryQuerySchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid history query" };
    const data = await settingsService.getHistory(actor.clinicId, parsed.data);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function rollbackSetting(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.history.rollback");
    const parsed = RollbackSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid rollback request" };

    const key = await settingsService.rollbackTenantSetting(actor.clinicId, actor, parsed.data.historyId);
    revalidatePath("/admin/settings");
    return { success: true, data: { key } };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function exportTenantSettings() {
  try {
    const actor = await getActor();
    await requirePermission("settings.core.manage");
    const document = await settingsService.exportTenantSettings(actor.clinicId);
    return { data: JSON.stringify(document, null, 2) };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function importTenantSettings(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.core.manage");
    const parsed = SettingsImportSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid import document" };

    const count = await settingsService.importTenantSettings(actor.clinicId, actor, parsed.data.json);
    revalidatePath("/admin/settings");
    return { success: true, data: { imported: count } };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export async function getLookupCategories() {
  try {
    await getActor();
    const data = await lookupService.getCategories();
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function getLookups(input: unknown) {
  try {
    const actor = await getActor();
    const parsed = LookupQuerySchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid lookup query" };
    const data = await lookupService.getValues(actor.clinicId, parsed.data.categoryCode);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function upsertLookupValue(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.lookups.manage");
    const parsed = LookupValueUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid lookup value" };

    const row = await lookupService.upsertTenantValue(actor.clinicId, parsed.data, actor.id);
    await auditService.logChange(actor.clinicId, "settings.lookup.updated", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "lookup_values",
      entityId: row.id,
      oldValues: null,
      newValues: { category: parsed.data.categoryCode, code: parsed.data.code, label: parsed.data.label },
    });
    revalidatePath("/admin/settings");
    return { success: true, data: row };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function deleteLookupValue(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.lookups.manage");
    const parsed = LookupValueDeleteSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid lookup value id" };

    await lookupService.deleteTenantValue(actor.clinicId, parsed.data.id, actor.id);
    await auditService.logChange(actor.clinicId, "settings.lookup.deleted", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "lookup_values",
      entityId: parsed.data.id,
      oldValues: null,
      newValues: null,
    });
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Notification templates
// ---------------------------------------------------------------------------
export async function getNotificationTemplates(input: unknown = {}) {
  try {
    const actor = await getActor();
    await requirePermission("settings.notifications.manage");
    const parsed = TemplatesQuerySchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid template query" };
    const data = await templateService.getTemplates(actor.clinicId, parsed.data.channel);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function upsertNotificationTemplate(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.notifications.manage");
    const parsed = TemplateUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid template" };

    const row = await templateService.upsertTenantTemplate(actor.clinicId, parsed.data, actor.id);
    await auditService.logChange(actor.clinicId, "settings.template.updated", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "notification_templates",
      entityId: row.id,
      oldValues: null,
      newValues: {
        channel: parsed.data.channel,
        template_key: parsed.data.template_key,
        locale: parsed.data.locale,
      },
    });
    revalidatePath("/admin/settings");
    return { success: true, data: row };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function previewTemplate(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.notifications.manage");
    const parsed = TemplatePreviewSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid preview request" };

    const data = await templateService.render(
      actor.clinicId,
      parsed.data.channel,
      parsed.data.template_key,
      parsed.data.locale,
      parsed.data.sampleData
    );
    if (!data) return { error: "Template not found" };
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Notification channels (secrets go to Vault; only { hasSecret } leaves the server)
// ---------------------------------------------------------------------------
export async function getNotificationChannels() {
  try {
    const actor = await getActor();
    await requirePermission("settings.notifications.manage");
    const channels = await repo.findChannels(actor.clinicId);
    const data = channels.map(({ secret_ref, ...channel }) => ({
      ...channel,
      hasSecret: secret_ref !== null,
    }));
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function upsertNotificationChannel(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.notifications.manage");
    const parsed = ChannelUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid channel configuration" };

    const { channel_type, config, secret, is_enabled } = parsed.data;
    const existing = await repo.findChannel(actor.clinicId, channel_type);

    let secretRef: string | null | undefined = undefined; // undefined = keep current
    if (secret) {
      if (existing?.secret_ref) {
        await secretStore.update(existing.secret_ref, secret);
        secretRef = existing.secret_ref;
      } else {
        secretRef = await secretStore.create(channelSecretName(actor.clinicId, channel_type), secret);
      }
    }

    const row = await repo.upsertChannel(
      actor.clinicId,
      channel_type,
      { config: config as Prisma.InputJsonValue, secretRef, isEnabled: is_enabled },
      actor.id
    );
    await auditService.logChange(actor.clinicId, "settings.channel.updated", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "notification_channels",
      entityId: row.id,
      oldValues: null,
      newValues: { channel_type, is_enabled, secretChanged: Boolean(secret) },
    });
    revalidatePath("/admin/settings");
    const { secret_ref, ...safeRow } = row;
    return { success: true, data: { ...safeRow, hasSecret: secret_ref !== null } };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Verifies the channel's stored secret is retrievable from Vault and marks the
 * channel verified. Live SMTP/SMS probing lands with the notification sender.
 */
export async function testNotificationChannel(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.notifications.manage");
    const parsed = ChannelTestSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid channel type" };

    const channel = await repo.findChannel(actor.clinicId, parsed.data.channel_type);
    if (!channel) return { error: "Channel is not configured yet" };
    if (!channel.secret_ref) return { error: "No secret is stored for this channel" };

    const secret = await secretStore.read(channel.secret_ref);
    if (!secret) {
      await repo.markChannelVerified(channel.id, false);
      return { error: "Stored secret could not be read from the vault" };
    }
    await repo.markChannelVerified(channel.id, true);
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Document sequences
// ---------------------------------------------------------------------------
export async function getDocumentSequences() {
  try {
    const actor = await getActor();
    await requirePermission("settings.sequences.manage");
    const rows = await sequenceService.getSequences(actor.clinicId);
    // BigInt is not serializable across the server-action boundary.
    const data = rows.map((row) => ({ ...row, current_value: Number(row.current_value) }));
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function upsertDocumentSequence(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.sequences.manage");
    const parsed = SequenceUpsertSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid sequence configuration" };

    const row = await sequenceService.upsertConfig(actor.clinicId, parsed.data, actor.id);
    await auditService.logChange(actor.clinicId, "settings.sequence.updated", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "document_sequences",
      entityId: row.id,
      oldValues: null,
      newValues: {
        document_type: parsed.data.document_type,
        prefix: parsed.data.prefix,
        padding: parsed.data.padding,
        reset_period: parsed.data.reset_period,
      },
    });
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function previewNextNumber(input: unknown) {
  try {
    const actor = await getActor();
    await requirePermission("settings.sequences.manage");
    const parsed = SequencePreviewSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid sequence configuration" };
    const data = await sequenceService.previewNext(actor.clinicId, parsed.data);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Feature flags (tenant view — read-only)
// ---------------------------------------------------------------------------
export async function getTenantFeatures() {
  try {
    const actor = await getActor();
    await requirePermission("settings.features.read");
    const data = await featureService.getTenantFeatures(actor.clinicId);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// User preferences (self-scope — no extra permission)
// ---------------------------------------------------------------------------
export async function getMyPreferences() {
  try {
    const actor = await getActor();
    const resolved = await settingsService.getResolvedSettings(actor.clinicId, actor.id);
    const data = resolved.filter((setting) => setting.allowed_scopes.includes("user"));
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function updateMyPreferences(input: unknown) {
  try {
    const actor = await getActor();
    const parsed = SettingsUpdateSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid preferences" };

    // updateUserSettings enforces that every key allows the 'user' scope.
    await settingsService.updateUserSettings(actor.id, actor.clinicId, parsed.data.updates);
    revalidatePath("/settings/preferences");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}
