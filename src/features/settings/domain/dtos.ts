// src/features/settings/domain/dtos.ts
// Zod schemas + inferred input types for the settings server actions and the
// tenant settings UI forms (mirrors src/features/rbac/domain/dtos.ts).
import { z } from "zod";
import { CHANNEL_TYPES, NOTIFICATION_CHANNELS } from "./models";
import { weeklyScheduleSchema } from "./validation";

// ---------------------------------------------------------------------------
// Generic key/value updates (values are re-validated per definition server-side)
// ---------------------------------------------------------------------------
export const SettingUpdateItemSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.unknown(),
});

export const SettingsUpdateSchema = z.object({
  updates: z.array(SettingUpdateItemSchema).min(1).max(100),
});
export type SettingsUpdateInput = z.infer<typeof SettingsUpdateSchema>;

export const HistoryQuerySchema = z.object({
  key: z.string().max(120).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type HistoryQueryInput = z.infer<typeof HistoryQuerySchema>;

export const RollbackSchema = z.object({
  historyId: z.string().uuid(),
});
export type RollbackInput = z.infer<typeof RollbackSchema>;

export const SettingsSearchSchema = z.object({
  query: z.string().min(1).max(120),
});
export type SettingsSearchInput = z.infer<typeof SettingsSearchSchema>;

export const SettingsImportSchema = z.object({
  json: z.string().min(2).max(200_000),
});
export type SettingsImportInput = z.infer<typeof SettingsImportSchema>;

/** Shape of the export/import JSON document. */
export const SettingsExportDocumentSchema = z.object({
  format: z.literal("clinic-settings/v1"),
  settings: z.array(SettingUpdateItemSchema),
});
export type SettingsExportDocument = z.infer<typeof SettingsExportDocumentSchema>;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export const LookupQuerySchema = z.object({
  categoryCode: z.string().min(1).max(80),
});
export type LookupQueryInput = z.infer<typeof LookupQuerySchema>;

export const LookupValueUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  categoryCode: z.string().min(1).max(80),
  code: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9_]*$/, "Code must be lowercase letters, digits and underscores"),
  label: z.string().min(1).max(200),
  label_ar: z.string().max(200).optional().nullable(),
  display_order: z.number().int().min(0).max(100000).default(0),
  is_active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
export type LookupValueUpsertInput = z.infer<typeof LookupValueUpsertSchema>;

export const LookupValueDeleteSchema = z.object({
  id: z.string().uuid(),
});
export type LookupValueDeleteInput = z.infer<typeof LookupValueDeleteSchema>;

// ---------------------------------------------------------------------------
// Notification templates + channels
// ---------------------------------------------------------------------------
export const TemplateUpsertSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  template_key: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, "Template key must use dot notation (e.g. appointment.reminder)"),
  locale: z.enum(["en", "ar"]),
  subject: z.string().max(300).optional().nullable(),
  body: z.string().min(1).max(10_000),
  variables: z.array(z.string().min(1).max(60)).optional().nullable(),
});
export type TemplateUpsertInput = z.infer<typeof TemplateUpsertSchema>;

export const TemplatesQuerySchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
});
export type TemplatesQueryInput = z.infer<typeof TemplatesQuerySchema>;

export const TemplatePreviewSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  template_key: z.string().min(1).max(120),
  locale: z.enum(["en", "ar"]),
  sampleData: z.record(z.string(), z.string()).default({}),
});
export type TemplatePreviewInput = z.infer<typeof TemplatePreviewSchema>;

export const ChannelUpsertSchema = z.object({
  channel_type: z.enum(CHANNEL_TYPES),
  /** Non-secret configuration (host, port, from_address, username, ...). */
  config: z.record(z.string(), z.unknown()).default({}),
  /** Plaintext secret (SMTP password / API key). Stored in Vault, never in the table. */
  secret: z.string().min(1).max(5000).optional(),
  is_enabled: z.boolean().default(false),
});
export type ChannelUpsertInput = z.infer<typeof ChannelUpsertSchema>;

export const ChannelTestSchema = z.object({
  channel_type: z.enum(CHANNEL_TYPES),
});
export type ChannelTestInput = z.infer<typeof ChannelTestSchema>;

// ---------------------------------------------------------------------------
// Document sequences
// ---------------------------------------------------------------------------
export const SequenceUpsertSchema = z.object({
  document_type: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Document type must be lowercase letters, digits and underscores"),
  prefix: z.string().max(20).default(""),
  padding: z.number().int().min(1).max(12).default(5),
  reset_period: z.enum(["never", "yearly", "monthly"]).default("never"),
  include_period: z.boolean().default(true),
});
export type SequenceUpsertInput = z.infer<typeof SequenceUpsertSchema>;

export const SequencePreviewSchema = SequenceUpsertSchema;
export type SequencePreviewInput = z.infer<typeof SequencePreviewSchema>;

// ---------------------------------------------------------------------------
// Setting definitions (app-owner)
// ---------------------------------------------------------------------------
export const DefinitionUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, "Key must use dot notation (e.g. appointments.slot_duration_minutes)"),
  module: z.string().min(1).max(60),
  category: z.string().min(1).max(60),
  value_type: z.enum(["string", "number", "boolean", "enum", "json", "color", "email", "weekly_schedule"]),
  default_value: z.unknown(),
  validation: z.record(z.string(), z.unknown()).optional().nullable(),
  allowed_scopes: z.array(z.enum(["platform", "tenant", "user"])).min(1),
  is_sensitive: z.boolean().default(false),
  is_public: z.boolean().default(false),
  description: z.string().max(500).optional().nullable(),
  display_order: z.number().int().min(0).max(100000).default(0),
});
export type DefinitionUpsertInput = z.infer<typeof DefinitionUpsertSchema>;

// ---------------------------------------------------------------------------
// Feature flags (app-owner) + tenant overrides
// ---------------------------------------------------------------------------
export const FeatureFlagUpsertSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9_]*$/, "Flag key must be lowercase letters, digits and underscores"),
  name: z.string().min(1).max(120),
  name_ar: z.string().max(120).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  default_enabled: z.boolean().default(false),
  kill_switch: z.boolean().default(false),
  is_beta: z.boolean().default(false),
});
export type FeatureFlagUpsertInput = z.infer<typeof FeatureFlagUpsertSchema>;

export const TenantFeatureOverrideSchema = z.object({
  tenantId: z.string().uuid(),
  featureKey: z.string().min(2).max(80),
  isEnabled: z.boolean(),
  reason: z.string().max(300).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type TenantFeatureOverrideInput = z.infer<typeof TenantFeatureOverrideSchema>;

// ---------------------------------------------------------------------------
// Tenant settings UI — per-tab form schemas (client UX; server re-validates
// every key against its definition)
// ---------------------------------------------------------------------------
export const generalSettingsFormSchema = z.object({
  display_name: z.string().max(120),
  legal_name: z.string().max(200),
  tax_number: z.string().max(50),
  address: z.string().max(500),
  contact_email: z.union([z.literal(""), z.string().email()]),
  contact_phone: z.string().max(30),
});
export type GeneralSettingsFormData = z.infer<typeof generalSettingsFormSchema>;

export const localizationFormSchema = z.object({
  default_language: z.enum(["en", "ar"]),
  timezone: z.string().min(1).max(64),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency code"),
  date_format: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  time_format: z.enum(["12h", "24h"]),
  first_day_of_week: z.enum(["saturday", "sunday", "monday"]),
});
export type LocalizationFormData = z.infer<typeof localizationFormSchema>;

export const brandingFormSchema = z.object({
  logo_url: z.union([z.literal(""), z.string().url()]),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color (expected #RRGGBB)"),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color (expected #RRGGBB)"),
  invoice_footer_text: z.string().max(500),
});
export type BrandingFormData = z.infer<typeof brandingFormSchema>;

export const workingHoursFormSchema = z.object({
  schedule: weeklyScheduleSchema,
});
export type WorkingHoursFormData = z.infer<typeof workingHoursFormSchema>;

export const appointmentsFormSchema = z.object({
  slot_duration_minutes: z.number().int().min(5).max(240),
  min_lead_time_hours: z.number().int().min(0).max(168),
  max_advance_days: z.number().int().min(1).max(365),
  cancellation_window_hours: z.number().int().min(0).max(168),
  allow_online_booking: z.boolean(),
  reminder_rules: z
    .array(
      z.object({
        channel: z.enum(NOTIFICATION_CHANNELS),
        offset_hours: z.number().int().min(1).max(720),
      })
    )
    .max(10),
});
export type AppointmentsFormData = z.infer<typeof appointmentsFormSchema>;

export const notificationsGeneralFormSchema = z.object({
  sender_name: z.string().max(100),
  reminders_enabled: z.boolean(),
});
export type NotificationsGeneralFormData = z.infer<typeof notificationsGeneralFormSchema>;

export const billingFormSchema = z.object({
  tax_rate_percent: z.number().min(0).max(100),
  invoice_due_days: z.number().int().min(0).max(365),
});
export type BillingFormData = z.infer<typeof billingFormSchema>;

export const userPreferencesFormSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  default_language: z.enum(["en", "ar"]),
  timezone: z.string().min(1).max(64),
  date_format: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
});
export type UserPreferencesFormData = z.infer<typeof userPreferencesFormSchema>;
