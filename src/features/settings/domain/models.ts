// src/features/settings/domain/models.ts
// Shared types for the Enterprise Global Settings Module.

export type SettingScope = "platform" | "tenant" | "user";

export type SettingsModule =
  | "organization"
  | "localization"
  | "branding"
  | "working_hours"
  | "appointments"
  | "notifications"
  | "billing"
  | "preferences"
  | "platform";

export type SettingValueType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "json"
  | "color"
  | "email"
  | "weekly_schedule";

/** Structural shape of a setting_definitions row as the engine consumes it. */
export interface SettingDefinition {
  id: string;
  key: string;
  module: string;
  category: string;
  value_type: string;
  default_value: unknown;
  validation: unknown;
  allowed_scopes: string[];
  is_sensitive: boolean;
  is_public: boolean;
  description: string | null;
  display_order: number;
}

/** A setting value after layered resolution (user > tenant > platform > default). */
export interface ResolvedSetting {
  key: string;
  module: string;
  category: string;
  value_type: string;
  value: unknown;
  source: SettingScope | "default";
  is_sensitive: boolean;
  is_public: boolean;
  description: string | null;
  display_order: number;
  allowed_scopes: string[];
  validation: unknown;
}

export interface DaySchedule {
  enabled: boolean;
  /** "HH:MM" 24h */
  start: string;
  /** "HH:MM" 24h */
  end: string;
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

export interface ReminderRule {
  channel: "email" | "sms" | "whatsapp" | "in_app";
  offset_hours: number;
}

export interface AppointmentSettings {
  slotDurationMinutes: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  allowOnlineBooking: boolean;
  reminderRules: ReminderRule[];
}

export interface LocalizationSettings {
  defaultLanguage: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: string;
}

export type FeatureDecisionSource =
  | "kill_switch"
  | "environment"
  | "tenant_override"
  | "plan"
  | "default"
  | "unknown_flag";

export interface FeatureDecision {
  key: string;
  enabled: boolean;
  source: FeatureDecisionSource;
  name?: string;
  name_ar?: string | null;
  description?: string | null;
  is_beta?: boolean;
}

export interface SequenceConfig {
  document_type: string;
  prefix: string;
  padding: number;
  reset_period: "never" | "yearly" | "monthly";
  include_period: boolean;
}

export interface RenderedTemplate {
  subject: string | null;
  body: string;
  /** Placeholders present in the template but missing from the supplied data. */
  missingVariables: string[];
  /** Where the template came from in the fallback chain. */
  source: "tenant" | "global";
  locale: string;
}

export const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const CHANNEL_TYPES = ["smtp", "twilio_sms", "whatsapp", "webhook"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const DOCUMENT_TYPES = ["invoice", "receipt", "patient_file", "lab_order"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Value stored in tenant_settings.value for sensitive definitions. */
export const MASKED_VALUE = { masked: true } as const;
