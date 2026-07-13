// src/features/settings/services/settings.service.ts
// Orchestration core of the settings module: layered reads (cached), validated
// bulk writes with history + audit, rollback, and export/import.
// Mirrors the RBAC service layering (repo + cache + audit injected, singleton export).
import { Prisma } from "@prisma/client";
import { auditService, AuditService } from "@/features/rbac/services/audit.service";
import { SettingsRepository } from "../repositories/settings.repository";
import { SettingsCacheService, settingsCacheService } from "./cache.service";
import { ResolutionService, resolutionService, ScopeValues } from "./resolution.service";
import { ISecretStore, secretStore } from "./vault.service";
import { validateSettingValue } from "../domain/validation";
import { SettingsExportDocumentSchema, type SettingsExportDocument } from "../domain/dtos";
import type { ResolvedSetting, SettingDefinition, SettingScope } from "../domain/models";
import { MASKED_VALUE } from "../domain/models";

export interface SettingsActor {
  id: string;
  email: string | null;
}

interface SettingUpdate {
  key: string;
  value: unknown;
}

interface ValidatedUpdate {
  definition: SettingDefinition;
  value: unknown;
}

function maskIfSensitive(definition: Pick<SettingDefinition, "is_sensitive">, value: unknown): unknown {
  return definition.is_sensitive ? MASKED_VALUE : value;
}

export class SettingsService {
  constructor(
    private repo: SettingsRepository = new SettingsRepository(),
    private cache: SettingsCacheService = settingsCacheService,
    private resolution: ResolutionService = resolutionService,
    private audit: AuditService = auditService,
    private secrets: ISecretStore = secretStore
  ) {}

  // --- Reads ---
  async getDefinitions(): Promise<SettingDefinition[]> {
    const cached = (await this.cache.getDefinitions()) as SettingDefinition[] | null;
    if (cached && cached.length > 0) return cached;
    const definitions = (await this.repo.findDefinitions()) as unknown as SettingDefinition[];
    if (definitions.length > 0) {
      await this.cache.setDefinitions(definitions);
    }
    return definitions;
  }

  private async getScopeValues(tenantId: string | null, profileId: string | null): Promise<ScopeValues> {
    const values: ScopeValues = {};

    const platformCached = await this.cache.getPlatform();
    const platformRows =
      (platformCached as { key: string; value: unknown }[] | null) ?? (await this.repo.findPlatformSettings());
    if (!platformCached) await this.cache.setPlatform(platformRows);
    values.platform = new Map(platformRows.map((row) => [row.key, row.value]));

    if (tenantId) {
      const tenantCached = await this.cache.getTenant(tenantId);
      const tenantRows =
        (tenantCached as { definition: { key: string }; value: unknown }[] | null) ??
        (await this.repo.findTenantSettings(tenantId));
      if (!tenantCached) await this.cache.setTenant(tenantId, tenantRows);
      values.tenant = new Map(tenantRows.map((row) => [row.definition.key, row.value]));
    }

    if (profileId) {
      const userCached = await this.cache.getUser(tenantId, profileId);
      const userRows =
        (userCached as { definition: { key: string }; value: unknown }[] | null) ??
        (await this.repo.findUserSettings(profileId));
      if (!userCached) await this.cache.setUser(tenantId, profileId, userRows);
      values.user = new Map(userRows.map((row) => [row.definition.key, row.value]));
    }

    return values;
  }

  /** Layered resolution for a tenant (and optionally the requesting user). */
  async getResolvedSettings(
    tenantId: string,
    profileId: string | null = null,
    options: { module?: string } = {}
  ): Promise<ResolvedSetting[]> {
    const [definitions, values] = await Promise.all([
      this.getDefinitions(),
      this.getScopeValues(tenantId, profileId),
    ]);
    return this.resolution.resolveAll(definitions, values, { module: options.module });
  }

  async getSettingValue<T>(tenantId: string, key: string, profileId: string | null = null): Promise<T> {
    let definitions = await this.getDefinitions();
    let definition = definitions.find((d) => d.key === key);
    if (!definition) {
      await this.cache.invalidateDefinitions();
      definitions = await this.getDefinitions();
      definition = definitions.find((d) => d.key === key);
      if (!definition) throw new Error(`Unknown setting key: ${key}`);
    }
    const values = await this.getScopeValues(tenantId, profileId);
    return this.resolution.resolveSetting(definition, values).value as T;
  }

  /** is_public definitions only — safe for unauthenticated surfaces. */
  async getPublicSettings(tenantId: string): Promise<Record<string, unknown>> {
    const [definitions, values] = await Promise.all([this.getDefinitions(), this.getScopeValues(tenantId, null)]);
    const resolved = this.resolution.resolveAll(definitions, values, { publicOnly: true });
    return this.resolution.toValueMap(resolved.filter((s) => !s.is_sensitive));
  }

  // --- Validation shared by all write paths ---
  private async validateUpdates(updates: SettingUpdate[], scope: SettingScope): Promise<ValidatedUpdate[]> {
    let definitions = await this.getDefinitions();
    const validated: ValidatedUpdate[] = [];
    for (const update of updates) {
      let definition = definitions.find((d) => d.key === update.key);
      if (!definition) {
        // Cache might be stale (e.g. DB seeded after app started)
        await this.cache.invalidateDefinitions();
        definitions = await this.getDefinitions();
        definition = definitions.find((d) => d.key === update.key);
        if (!definition) throw new Error(`Unknown setting key: ${update.key}`);
      }
      if (!definition.allowed_scopes.includes(scope)) {
        throw new Error(`Setting "${update.key}" cannot be set at the ${scope} level`);
      }
      const result = validateSettingValue(definition, update.value);
      if (!result.success) throw new Error(result.error);
      validated.push({ definition, value: result.value });
    }
    return validated;
  }

  // --- Tenant writes ---
  async updateTenantSettings(tenantId: string, actor: SettingsActor, updates: SettingUpdate[]): Promise<void> {
    const validated = await this.validateUpdates(updates, "tenant");
    const auditOld: Record<string, unknown> = {};
    const auditNew: Record<string, unknown> = {};

    await this.repo.runInTransaction(async (tx) => {
      for (const { definition, value } of validated) {
        const existing = await this.repo.findTenantSetting(tenantId, definition.id, tx);
        const oldValue = existing ? existing.value : null;
        const version = (existing?.version ?? 0) + 1;

        let storedValue = value as Prisma.InputJsonValue;
        let vaultSecretId: string | null = existing?.vault_secret_id ?? null;
        if (definition.is_sensitive && typeof value === "string") {
          vaultSecretId = existing?.vault_secret_id
            ? (await this.secrets.update(existing.vault_secret_id, value), existing.vault_secret_id)
            : await this.secrets.create(`tenant:${tenantId}:setting:${definition.key}`, value);
          storedValue = MASKED_VALUE as unknown as Prisma.InputJsonValue;
        }

        await this.repo.upsertTenantSetting(tenantId, definition.id, storedValue, actor.id, vaultSecretId, tx);
        await this.repo.createHistory(
          {
            scope: "tenant",
            tenantId,
            profileId: null,
            definitionKey: definition.key,
            oldValue: maskIfSensitive(definition, oldValue),
            newValue: maskIfSensitive(definition, value),
            version,
            changeReason: null,
            changedBy: actor.id,
          },
          tx
        );
        auditOld[definition.key] = maskIfSensitive(definition, oldValue);
        auditNew[definition.key] = maskIfSensitive(definition, value);
      }
    });

    await this.audit.logChange(tenantId, "settings.updated", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "tenant_settings",
      entityId: tenantId,
      oldValues: auditOld,
      newValues: auditNew,
    });
    await this.cache.invalidateTenant(tenantId);
  }

  // --- User writes ---
  async updateUserSettings(
    profileId: string,
    tenantId: string | null,
    updates: SettingUpdate[]
  ): Promise<void> {
    const validated = await this.validateUpdates(updates, "user");
    await this.repo.runInTransaction(async (tx) => {
      for (const { definition, value } of validated) {
        await this.repo.upsertUserSetting(profileId, tenantId, definition.id, value as Prisma.InputJsonValue, tx);
        await this.repo.createHistory(
          {
            scope: "user",
            tenantId,
            profileId,
            definitionKey: definition.key,
            oldValue: null,
            newValue: value,
            version: 1,
            changeReason: null,
            changedBy: profileId,
          },
          tx
        );
      }
    });
    await this.cache.invalidateUser(tenantId, profileId);
  }

  // --- Platform writes (app-owner) ---
  async updatePlatformSettings(actor: SettingsActor, updates: SettingUpdate[]): Promise<void> {
    const validated = await this.validateUpdates(updates, "platform");
    await this.repo.runInTransaction(async (tx) => {
      for (const { definition, value } of validated) {
        await this.repo.upsertPlatformSetting(
          definition.key,
          definition.module,
          value as Prisma.InputJsonValue,
          definition.is_public,
          actor.id,
          definition.description,
          tx
        );
        await this.repo.createHistory(
          {
            scope: "platform",
            tenantId: null,
            profileId: null,
            definitionKey: definition.key,
            oldValue: null,
            newValue: maskIfSensitive(definition, value),
            version: 1,
            changeReason: null,
            changedBy: actor.id,
          },
          tx
        );
      }
    });
    await this.cache.invalidatePlatform();
  }

  // --- History / rollback ---
  async getHistory(tenantId: string, query: { key?: string; page: number; limit: number }) {
    return this.repo.findHistory(tenantId, query);
  }

  async rollbackTenantSetting(tenantId: string, actor: SettingsActor, historyId: string): Promise<string> {
    const entry = await this.repo.findHistoryById(historyId);
    if (!entry || entry.tenant_id !== tenantId || entry.scope !== "tenant") {
      throw new Error("History entry not found");
    }
    if (entry.old_value === null) {
      throw new Error("This entry has no previous value to roll back to");
    }
    const definitions = await this.getDefinitions();
    const definition = definitions.find((d) => d.key === entry.definition_key);
    if (!definition) throw new Error(`Setting "${entry.definition_key}" no longer exists`);
    if (definition.is_sensitive) {
      throw new Error("Sensitive settings cannot be rolled back — re-enter the secret instead");
    }
    await this.updateTenantSettings(tenantId, actor, [
      { key: entry.definition_key, value: entry.old_value },
    ]);
    return entry.definition_key;
  }

  // --- Export / import ---
  async exportTenantSettings(tenantId: string): Promise<SettingsExportDocument> {
    const resolved = await this.getResolvedSettings(tenantId);
    return {
      format: "clinic-settings/v1",
      settings: resolved
        .filter((s) => !s.is_sensitive && s.allowed_scopes.includes("tenant"))
        .map((s) => ({ key: s.key, value: s.value })),
    };
  }

  async importTenantSettings(tenantId: string, actor: SettingsActor, json: string): Promise<number> {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(json);
    } catch {
      throw new Error("Invalid JSON document");
    }
    const document = SettingsExportDocumentSchema.safeParse(parsedJson);
    if (!document.success) {
      throw new Error("Not a valid clinic-settings/v1 export document");
    }
    const definitions = await this.getDefinitions();
    const importable = document.data.settings.filter((item) => {
      const definition = definitions.find((d) => d.key === item.key);
      return definition && !definition.is_sensitive && definition.allowed_scopes.includes("tenant");
    });
    if (importable.length === 0) throw new Error("The document contains no importable settings");
    // validateUpdates runs again inside — all-or-nothing in one transaction.
    await this.updateTenantSettings(tenantId, actor, importable);
    return importable.length;
  }

  // --- Search ---
  async searchSettings(tenantId: string, profileId: string | null, query: string): Promise<ResolvedSetting[]> {
    const resolved = await this.getResolvedSettings(tenantId, profileId);
    const needle = query.toLowerCase();
    return resolved.filter(
      (s) =>
        s.key.toLowerCase().includes(needle) ||
        (s.description ?? "").toLowerCase().includes(needle) ||
        s.module.toLowerCase().includes(needle)
    );
  }
}

export const settingsService = new SettingsService();
