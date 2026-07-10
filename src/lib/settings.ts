// src/lib/settings.ts
// Typed facade over the settings engine — what app code imports.
// Server-side only. Values resolve user > tenant > platform > default and are
// deduplicated per request via React cache().
import { cache } from "react";
import { requireTenantInfo } from "@/lib/auth";
import { settingsService } from "@/features/settings/services/settings.service";
import type {
  AppointmentSettings,
  LocalizationSettings,
  ReminderRule,
  SettingsModule,
  WeeklySchedule,
} from "@/features/settings/domain/models";

const getResolvedForCurrentTenant = cache(async (module?: string) => {
  const tenant = await requireTenantInfo();
  return settingsService.getResolvedSettings(tenant.clinicId, tenant.profileId, { module });
});

/** Resolved value of a single setting for the current tenant/user context. */
export async function getSetting<T>(key: string): Promise<T> {
  const tenant = await requireTenantInfo();
  return settingsService.getSettingValue<T>(tenant.clinicId, key, tenant.profileId);
}

/** All resolved values of one module as a key -> value record. */
export async function getModuleSettings(module: SettingsModule): Promise<Record<string, unknown>> {
  const resolved = await getResolvedForCurrentTenant(module);
  return resolved.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, [s.key]: s.value }), {});
}

export async function getAppointmentSettings(): Promise<AppointmentSettings> {
  const values = await getModuleSettings("appointments");
  return {
    slotDurationMinutes: values["appointments.slot_duration_minutes"] as number,
    minLeadTimeHours: values["appointments.min_lead_time_hours"] as number,
    maxAdvanceDays: values["appointments.max_advance_days"] as number,
    cancellationWindowHours: values["appointments.cancellation_window_hours"] as number,
    allowOnlineBooking: values["appointments.allow_online_booking"] as boolean,
    reminderRules: values["appointments.reminder_rules"] as ReminderRule[],
  };
}

export async function getWorkingHours(): Promise<WeeklySchedule> {
  return getSetting<WeeklySchedule>("working_hours.schedule");
}

export async function getLocalization(): Promise<LocalizationSettings> {
  const values = await getModuleSettings("localization");
  return {
    defaultLanguage: values["localization.default_language"] as string,
    timezone: values["localization.timezone"] as string,
    currency: values["localization.currency"] as string,
    dateFormat: values["localization.date_format"] as string,
    timeFormat: values["localization.time_format"] as string,
    firstDayOfWeek: values["localization.first_day_of_week"] as string,
  };
}

/**
 * is_public settings for an explicit tenant — safe for unauthenticated
 * surfaces (public booking/landing pages). Never includes sensitive values.
 */
export async function getPublicSettings(tenantId: string): Promise<Record<string, unknown>> {
  return settingsService.getPublicSettings(tenantId);
}
