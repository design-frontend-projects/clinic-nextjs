// src/features/settings/repositories/settings.repository.ts
// All Prisma access for the settings module. Every method accepts an optional
// transaction client so services can compose multi-step writes (mirrors
// src/features/rbac/repositories/rbac.repository.ts).
//
// NOTE: lookup_values and notification_templates are guarded by PARTIAL unique
// indexes in SQL that Prisma cannot express — those upserts must go through
// the find-then-write helpers here, inside a transaction, never prisma.upsert.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { SettingScope } from "../domain/models";

export interface HistoryEntry {
  scope: SettingScope;
  tenantId: string | null;
  profileId: string | null;
  definitionKey: string;
  oldValue: unknown;
  newValue: unknown;
  version: number;
  changeReason: string | null;
  changedBy: string | null;
}

export class SettingsRepository {
  async runInTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(callback);
  }

  // --- Setting definitions ---
  async findDefinitions(tx: Prisma.TransactionClient = prisma) {
    return tx.setting_definitions.findMany({
      where: { deleted_at: null, is_active: true },
      orderBy: [{ module: "asc" }, { display_order: "asc" }],
    });
  }

  async findDefinitionByKey(key: string, tx: Prisma.TransactionClient = prisma) {
    return tx.setting_definitions.findFirst({
      where: { key, deleted_at: null, is_active: true },
    });
  }

  async upsertDefinition(
    data: {
      key: string;
      module: string;
      category: string;
      value_type: string;
      default_value: Prisma.InputJsonValue;
      validation: Prisma.InputJsonValue | null;
      allowed_scopes: string[];
      is_sensitive: boolean;
      is_public: boolean;
      description: string | null;
      display_order: number;
    },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    const { key, validation, ...rest } = data;
    const validationValue = validation === null ? Prisma.DbNull : validation;
    return tx.setting_definitions.upsert({
      where: { key },
      update: { ...rest, validation: validationValue, updated_by: actorId },
      create: { key, ...rest, validation: validationValue, created_by: actorId, updated_by: actorId },
    });
  }

  // --- Platform values (existing global_settings table, matched by definition key) ---
  async findPlatformSettings(tx: Prisma.TransactionClient = prisma) {
    return tx.global_settings.findMany({ orderBy: { category: "asc" } });
  }

  async upsertPlatformSetting(
    key: string,
    category: string,
    value: Prisma.InputJsonValue,
    isPublic: boolean,
    actorId: string | null,
    description: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.global_settings.upsert({
      where: { key },
      update: { value, updated_by: actorId },
      create: { key, category, value, is_public: isPublic, description },
    });
  }

  // --- Tenant values ---
  async findTenantSettings(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.tenant_settings.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      include: { definition: true },
    });
  }

  async findTenantSetting(tenantId: string, definitionId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.tenant_settings.findFirst({
      where: { tenant_id: tenantId, definition_id: definitionId, deleted_at: null },
    });
  }

  async upsertTenantSetting(
    tenantId: string,
    definitionId: string,
    value: Prisma.InputJsonValue,
    actorId: string | null,
    vaultSecretId: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.tenant_settings.upsert({
      where: { tenant_id_definition_id: { tenant_id: tenantId, definition_id: definitionId } },
      update: {
        value,
        vault_secret_id: vaultSecretId,
        version: { increment: 1 },
        deleted_at: null,
        is_active: true,
        updated_by: actorId,
      },
      create: {
        tenant_id: tenantId,
        definition_id: definitionId,
        value,
        vault_secret_id: vaultSecretId,
        created_by: actorId,
        updated_by: actorId,
      },
    });
  }

  // --- User values ---
  async findUserSettings(profileId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.user_settings.findMany({
      where: { profile_id: profileId, deleted_at: null },
      include: { definition: true },
    });
  }

  async upsertUserSetting(
    profileId: string,
    tenantId: string | null,
    definitionId: string,
    value: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.user_settings.upsert({
      where: { profile_id_definition_id: { profile_id: profileId, definition_id: definitionId } },
      update: { value, version: { increment: 1 }, deleted_at: null, is_active: true, updated_by: profileId },
      create: {
        profile_id: profileId,
        tenant_id: tenantId,
        definition_id: definitionId,
        value,
        created_by: profileId,
        updated_by: profileId,
      },
    });
  }

  // --- History ---
  async createHistory(entry: HistoryEntry, tx: Prisma.TransactionClient = prisma) {
    return tx.settings_history.create({
      data: {
        scope: entry.scope,
        tenant_id: entry.tenantId,
        profile_id: entry.profileId,
        definition_key: entry.definitionKey,
        old_value: (entry.oldValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
        new_value: (entry.newValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
        version: entry.version,
        change_reason: entry.changeReason,
        changed_by: entry.changedBy,
      },
    });
  }

  async findHistory(
    tenantId: string,
    query: { key?: string; page: number; limit: number },
    tx: Prisma.TransactionClient = prisma
  ) {
    const where: Prisma.settings_historyWhereInput = {
      tenant_id: tenantId,
      ...(query.key ? { definition_key: query.key } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.settings_history.findMany({
        where,
        orderBy: { changed_at: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      tx.settings_history.count({ where }),
    ]);
    return { rows, total };
  }

  async findHistoryById(id: string, tx: Prisma.TransactionClient = prisma) {
    return tx.settings_history.findFirst({ where: { id } });
  }

  // --- Lookups ---
  async findLookupCategories(tx: Prisma.TransactionClient = prisma) {
    return tx.lookup_categories.findMany({
      where: { deleted_at: null, is_active: true },
      orderBy: { code: "asc" },
    });
  }

  async findLookupCategoryByCode(code: string, tx: Prisma.TransactionClient = prisma) {
    return tx.lookup_categories.findFirst({ where: { code, deleted_at: null } });
  }

  /** Global rows (tenant_id NULL) + this tenant's rows for one category. */
  async findLookupValues(categoryId: string, tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.lookup_values.findMany({
      where: {
        category_id: categoryId,
        deleted_at: null,
        OR: [{ tenant_id: null }, { tenant_id: tenantId }],
      },
      orderBy: [{ display_order: "asc" }, { code: "asc" }],
    });
  }

  async findLookupValueById(id: string, tx: Prisma.TransactionClient = prisma) {
    return tx.lookup_values.findFirst({ where: { id, deleted_at: null } });
  }

  /** Partial-unique-safe lookup by natural key (tenantId null = global row). */
  async findLookupValueByCode(
    categoryId: string,
    tenantId: string | null,
    code: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.lookup_values.findFirst({
      where: { category_id: categoryId, tenant_id: tenantId, code },
    });
  }

  async createLookupValue(
    data: {
      categoryId: string;
      tenantId: string | null;
      code: string;
      label: string;
      labelAr: string | null;
      metadata: Prisma.InputJsonValue | null;
      displayOrder: number;
      isActive: boolean;
    },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.lookup_values.create({
      data: {
        category_id: data.categoryId,
        tenant_id: data.tenantId,
        code: data.code,
        label: data.label,
        label_ar: data.labelAr,
        metadata: data.metadata === null ? Prisma.DbNull : data.metadata,
        display_order: data.displayOrder,
        is_active: data.isActive,
        created_by: actorId,
        updated_by: actorId,
      },
    });
  }

  async updateLookupValue(
    id: string,
    data: {
      label?: string;
      labelAr?: string | null;
      metadata?: Prisma.InputJsonValue | null;
      displayOrder?: number;
      isActive?: boolean;
      deletedAt?: Date | null;
    },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.lookup_values.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.labelAr !== undefined ? { label_ar: data.labelAr } : {}),
        ...(data.metadata !== undefined
          ? { metadata: data.metadata === null ? Prisma.DbNull : data.metadata }
          : {}),
        ...(data.displayOrder !== undefined ? { display_order: data.displayOrder } : {}),
        ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
        ...(data.deletedAt !== undefined ? { deleted_at: data.deletedAt } : {}),
        updated_by: actorId,
      },
    });
  }

  // --- Feature flags ---
  async findFeatureFlags(tx: Prisma.TransactionClient = prisma) {
    return tx.feature_flags.findMany({
      where: { deleted_at: null, is_active: true },
      orderBy: { key: "asc" },
    });
  }

  async findTenantFeatureOverrides(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.tenant_feature_overrides.findMany({
      where: { tenant_id: tenantId, deleted_at: null, is_active: true },
    });
  }

  async upsertFeatureFlag(
    data: {
      key: string;
      name: string;
      name_ar: string | null;
      description: string | null;
      default_enabled: boolean;
      kill_switch: boolean;
      is_beta: boolean;
    },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    const { key, ...rest } = data;
    return tx.feature_flags.upsert({
      where: { key },
      update: { ...rest, updated_by: actorId },
      create: { key, ...rest, created_by: actorId, updated_by: actorId },
    });
  }

  async upsertTenantFeatureOverride(
    tenantId: string,
    featureKey: string,
    data: { isEnabled: boolean; reason: string | null; expiresAt: Date | null },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.tenant_feature_overrides.upsert({
      where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
      update: {
        is_enabled: data.isEnabled,
        reason: data.reason,
        expires_at: data.expiresAt,
        deleted_at: null,
        is_active: true,
        updated_by: actorId,
      },
      create: {
        tenant_id: tenantId,
        feature_key: featureKey,
        is_enabled: data.isEnabled,
        reason: data.reason,
        expires_at: data.expiresAt,
        created_by: actorId,
        updated_by: actorId,
      },
    });
  }

  /**
   * Plan feature entitlements for a tenant: the active tenant_subscription's
   * plan features, falling back to a plan matched by the legacy
   * clinics.subscription_plan string. Returns null when no plan resolves.
   */
  async findPlanFeaturesForTenant(
    tenantId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<{ feature_name: string; is_enabled: boolean }[] | null> {
    const subscription = await tx.tenant_subscriptions.findFirst({
      where: { tenant_id: tenantId, status: "active" },
      include: { plan: { include: { features: true } } },
    });
    if (subscription?.plan) {
      return subscription.plan.features.map((f) => ({
        feature_name: f.feature_name,
        is_enabled: f.is_enabled,
      }));
    }

    const clinic = await tx.clinics.findFirst({
      where: { id: tenantId },
      select: { subscription_plan: true },
    });
    if (!clinic?.subscription_plan) return null;

    const legacyPlan = await tx.subscription_plans.findFirst({
      where: {
        name: { contains: clinic.subscription_plan, mode: "insensitive" },
        deleted_at: null,
      },
      include: { features: true },
    });
    if (!legacyPlan) return null;
    return legacyPlan.features.map((f) => ({
      feature_name: f.feature_name,
      is_enabled: f.is_enabled,
    }));
  }

  // --- Document sequences ---
  async findSequences(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.document_sequences.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: [{ document_type: "asc" }, { created_at: "desc" }],
    });
  }

  async findLatestSequence(tenantId: string, documentType: string, tx: Prisma.TransactionClient = prisma) {
    return tx.document_sequences.findFirst({
      where: { tenant_id: tenantId, document_type: documentType, deleted_at: null },
      orderBy: { created_at: "desc" },
    });
  }

  async findSequenceByPeriod(
    tenantId: string,
    documentType: string,
    periodKey: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.document_sequences.findFirst({
      where: {
        tenant_id: tenantId,
        document_type: documentType,
        period_key: periodKey,
        deleted_at: null,
      },
    });
  }

  async createSequence(
    tenantId: string,
    data: {
      documentType: string;
      prefix: string;
      padding: number;
      resetPeriod: string;
      includePeriod: boolean;
      periodKey: string;
    },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.document_sequences.create({
      data: {
        tenant_id: tenantId,
        document_type: data.documentType,
        prefix: data.prefix,
        padding: data.padding,
        reset_period: data.resetPeriod,
        include_period: data.includePeriod,
        period_key: data.periodKey,
        created_by: actorId,
        updated_by: actorId,
      },
    });
  }

  async updateSequenceConfig(
    id: string,
    data: { prefix: string; padding: number; resetPeriod: string; includePeriod: boolean },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.document_sequences.update({
      where: { id },
      data: {
        prefix: data.prefix,
        padding: data.padding,
        reset_period: data.resetPeriod,
        include_period: data.includePeriod,
        updated_by: actorId,
      },
    });
  }

  /** Atomic number claim — delegates to public.claim_document_number(). */
  async claimDocumentNumber(tenantId: string, documentType: string): Promise<string> {
    const rows = await prisma.$queryRaw<{ number: string }[]>`
      SELECT public.claim_document_number(${tenantId}::uuid, ${documentType}) AS number
    `;
    const number = rows[0]?.number;
    if (!number) {
      throw new Error(`Failed to claim a document number for type "${documentType}"`);
    }
    return number;
  }

  // --- Notification templates ---
  /** Global templates + this tenant's overrides. */
  async findTemplates(tenantId: string, channel?: string, tx: Prisma.TransactionClient = prisma) {
    return tx.notification_templates.findMany({
      where: {
        deleted_at: null,
        ...(channel ? { channel } : {}),
        OR: [{ tenant_id: null }, { tenant_id: tenantId }],
      },
      orderBy: [{ template_key: "asc" }, { channel: "asc" }, { locale: "asc" }],
    });
  }

  /** Partial-unique-safe lookup by natural key (tenantId null = global row). */
  async findTemplateByNaturalKey(
    tenantId: string | null,
    channel: string,
    templateKey: string,
    locale: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.notification_templates.findFirst({
      where: { tenant_id: tenantId, channel, template_key: templateKey, locale },
    });
  }

  async createTemplate(
    data: {
      tenantId: string | null;
      channel: string;
      templateKey: string;
      locale: string;
      subject: string | null;
      body: string;
      variables: Prisma.InputJsonValue | null;
    },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.notification_templates.create({
      data: {
        tenant_id: data.tenantId,
        channel: data.channel,
        template_key: data.templateKey,
        locale: data.locale,
        subject: data.subject,
        body: data.body,
        variables: data.variables === null ? Prisma.DbNull : data.variables,
        created_by: actorId,
        updated_by: actorId,
      },
    });
  }

  async updateTemplate(
    id: string,
    data: { subject: string | null; body: string; variables: Prisma.InputJsonValue | null },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.notification_templates.update({
      where: { id },
      data: {
        subject: data.subject,
        body: data.body,
        variables: data.variables === null ? Prisma.DbNull : data.variables,
        deleted_at: null,
        is_active: true,
        updated_by: actorId,
      },
    });
  }

  // --- Notification channels ---
  async findChannels(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.notification_channels.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: { channel_type: "asc" },
    });
  }

  async findChannel(tenantId: string, channelType: string, tx: Prisma.TransactionClient = prisma) {
    return tx.notification_channels.findFirst({
      where: { tenant_id: tenantId, channel_type: channelType, deleted_at: null },
    });
  }

  async upsertChannel(
    tenantId: string,
    channelType: string,
    data: { config: Prisma.InputJsonValue; secretRef?: string | null; isEnabled: boolean },
    actorId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.notification_channels.upsert({
      where: { tenant_id_channel_type: { tenant_id: tenantId, channel_type: channelType } },
      update: {
        config: data.config,
        ...(data.secretRef !== undefined ? { secret_ref: data.secretRef } : {}),
        is_enabled: data.isEnabled,
        deleted_at: null,
        is_active: true,
        updated_by: actorId,
      },
      create: {
        tenant_id: tenantId,
        channel_type: channelType,
        config: data.config,
        secret_ref: data.secretRef ?? null,
        is_enabled: data.isEnabled,
        created_by: actorId,
        updated_by: actorId,
      },
    });
  }

  async markChannelVerified(id: string, verified: boolean, tx: Prisma.TransactionClient = prisma) {
    return tx.notification_channels.update({
      where: { id },
      data: { is_verified: verified, last_verified_at: verified ? new Date() : null },
    });
  }
}
