// src/features/settings/services/lookup.service.ts
// Lookup lists with tenant shadowing: a tenant row with the same code replaces
// the global row for that tenant (including hiding it via is_active=false).
// Writes use find-then-write in a transaction because uniqueness is enforced
// by PARTIAL unique indexes Prisma cannot express.
import { Prisma } from "@prisma/client";
import { SettingsRepository } from "../repositories/settings.repository";
import { SettingsCacheService, settingsCacheService } from "./cache.service";
import type { LookupValueUpsertInput } from "../domain/dtos";

export interface ResolvedLookupValue {
  id: string;
  code: string;
  label: string;
  label_ar: string | null;
  metadata: unknown;
  display_order: number;
  is_active: boolean;
  /** Whether this row is the tenant's own (true) or a global default (false). */
  is_tenant_value: boolean;
  /** True when a tenant row shadows a global row of the same code. */
  shadows_global: boolean;
}

interface LookupValueRow {
  id: string;
  tenant_id: string | null;
  code: string;
  label: string;
  label_ar: string | null;
  metadata: unknown;
  display_order: number;
  is_active: boolean;
}

/** Pure shadowing merge — tenant rows win per code. */
export function mergeLookupValues(rows: LookupValueRow[]): ResolvedLookupValue[] {
  const globalCodes = new Set(rows.filter((r) => r.tenant_id === null).map((r) => r.code));
  const tenantByCode = new Map(rows.filter((r) => r.tenant_id !== null).map((r) => [r.code, r]));

  const merged = rows
    .filter((row) => (row.tenant_id === null ? !tenantByCode.has(row.code) : true))
    .map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      label_ar: row.label_ar,
      metadata: row.metadata,
      display_order: row.display_order,
      is_active: row.is_active,
      is_tenant_value: row.tenant_id !== null,
      shadows_global: row.tenant_id !== null && globalCodes.has(row.code),
    }));

  return [...merged].sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code));
}

export class LookupService {
  constructor(
    private repo: SettingsRepository = new SettingsRepository(),
    private cache: SettingsCacheService = settingsCacheService
  ) {}

  async getCategories() {
    return this.repo.findLookupCategories();
  }

  /** Resolved (shadow-merged) values for one category. Cached per tenant. */
  async getValues(tenantId: string, categoryCode: string): Promise<ResolvedLookupValue[]> {
    const cached = (await this.cache.getLookups(tenantId, categoryCode)) as ResolvedLookupValue[] | null;
    if (cached) return cached;

    const category = await this.repo.findLookupCategoryByCode(categoryCode);
    if (!category) throw new Error(`Unknown lookup category: ${categoryCode}`);

    const rows = await this.repo.findLookupValues(category.id, tenantId);
    const merged = mergeLookupValues(rows);
    await this.cache.setLookups(tenantId, categoryCode, merged);
    return merged;
  }

  /** Active values only — what feature UIs (booking forms etc.) consume. */
  async getActiveValues(tenantId: string, categoryCode: string): Promise<ResolvedLookupValue[]> {
    const values = await this.getValues(tenantId, categoryCode);
    return values.filter((v) => v.is_active);
  }

  /** Creates or updates a TENANT row (global rows are shadowed, never edited). */
  async upsertTenantValue(tenantId: string, input: LookupValueUpsertInput, actorId: string | null) {
    const category = await this.repo.findLookupCategoryByCode(input.categoryCode);
    if (!category) throw new Error(`Unknown lookup category: ${input.categoryCode}`);
    if (!category.allow_tenant_values) {
      throw new Error(`Category "${input.categoryCode}" does not allow clinic-specific values`);
    }

    const metadata = (input.metadata ?? null) as Prisma.InputJsonValue | null;
    const result = await this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findLookupValueByCode(category.id, tenantId, input.code, tx);
      if (existing) {
        return this.repo.updateLookupValue(
          existing.id,
          {
            label: input.label,
            labelAr: input.label_ar ?? null,
            metadata,
            displayOrder: input.display_order,
            isActive: input.is_active,
            deletedAt: null,
          },
          actorId,
          tx
        );
      }
      return this.repo.createLookupValue(
        {
          categoryId: category.id,
          tenantId,
          code: input.code,
          label: input.label,
          labelAr: input.label_ar ?? null,
          metadata,
          displayOrder: input.display_order,
          isActive: input.is_active,
        },
        actorId,
        tx
      );
    });

    await this.cache.invalidateLookups(tenantId, input.categoryCode);
    return result;
  }

  /**
   * Soft-deletes a TENANT row. Global rows cannot be deleted by tenants — the
   * UI hides them by upserting a tenant shadow row with is_active=false.
   */
  async deleteTenantValue(tenantId: string, id: string, actorId: string | null) {
    const row = await this.repo.findLookupValueById(id);
    if (!row || row.tenant_id !== tenantId) {
      throw new Error("Lookup value not found");
    }
    await this.repo.updateLookupValue(id, { deletedAt: new Date(), isActive: false }, actorId);
    const category = (await this.repo.findLookupCategories()).find((c) => c.id === row.category_id);
    if (category) await this.cache.invalidateLookups(tenantId, category.code);
  }

  /** App-owner: creates or updates a GLOBAL row (tenant_id NULL). */
  async upsertGlobalValue(input: LookupValueUpsertInput, actorId: string | null) {
    const category = await this.repo.findLookupCategoryByCode(input.categoryCode);
    if (!category) throw new Error(`Unknown lookup category: ${input.categoryCode}`);

    const metadata = (input.metadata ?? null) as Prisma.InputJsonValue | null;
    return this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findLookupValueByCode(category.id, null, input.code, tx);
      if (existing) {
        return this.repo.updateLookupValue(
          existing.id,
          {
            label: input.label,
            labelAr: input.label_ar ?? null,
            metadata,
            displayOrder: input.display_order,
            isActive: input.is_active,
            deletedAt: null,
          },
          actorId,
          tx
        );
      }
      return this.repo.createLookupValue(
        {
          categoryId: category.id,
          tenantId: null,
          code: input.code,
          label: input.label,
          labelAr: input.label_ar ?? null,
          metadata,
          displayOrder: input.display_order,
          isActive: input.is_active,
        },
        actorId,
        tx
      );
    });
  }
}

export const lookupService = new LookupService();
