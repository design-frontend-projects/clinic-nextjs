# Settings Module — API Reference (Server Actions)

There is no REST layer; the API surface is Next.js server actions following the repo conventions (`{ data }` / `{ error }` / `{ success: true }` returns, Zod-validated inputs).

## Tenant + user actions — `src/features/settings/actions.ts`

| Action | Input | Returns | Permission | Cache invalidated | Revalidates |
|---|---|---|---|---|---|
| `getTenantSettings(module?)` | module name | `{ data: ResolvedSetting[] }` | `settings.core.read` | — | — |
| `updateTenantSettings` | `{ updates: [{key, value}] }` (≤100) | `{ success }` | `settings.core.manage` | `settings:tenant:{id}` | `/admin/settings` |
| `searchSettings` | `{ query }` | `{ data: ResolvedSetting[] }` | `settings.core.read` | — | — |
| `getSettingsHistory` | `{ key?, page?, limit? }` | `{ data: { rows, total } }` | `settings.history.read` | — | — |
| `rollbackSetting` | `{ historyId }` | `{ success, data: { key } }` | `settings.history.rollback` | tenant | `/admin/settings` |
| `exportTenantSettings` | — | `{ data: json string }` (`clinic-settings/v1`) | `settings.core.manage` | — | — |
| `importTenantSettings` | `{ json }` | `{ success, data: { imported } }` | `settings.core.manage` | tenant | `/admin/settings` |
| `getLookupCategories` | — | `{ data }` | any authenticated tenant user | — | — |
| `getLookups` | `{ categoryCode }` | `{ data: ResolvedLookupValue[] }` (shadow-merged) | any authenticated tenant user | — | — |
| `upsertLookupValue` | `LookupValueUpsertInput` | `{ success, data }` | `settings.lookups.manage` | `lookups:{id}:{cat}` | `/admin/settings` |
| `deleteLookupValue` | `{ id }` (tenant rows only) | `{ success }` | `settings.lookups.manage` | lookups | `/admin/settings` |
| `getNotificationTemplates` | `{ channel? }` | `{ data }` (globals + tenant overrides) | `settings.notifications.manage` | — | — |
| `upsertNotificationTemplate` | `TemplateUpsertInput` | `{ success, data }` (tenant override) | `settings.notifications.manage` | `templates:{id}` | `/admin/settings` |
| `previewTemplate` | `{ channel, template_key, locale, sampleData }` | `{ data: RenderedTemplate }` | `settings.notifications.manage` | — | — |
| `getNotificationChannels` | — | `{ data }` — `secret_ref` → `hasSecret` | `settings.notifications.manage` | — | — |
| `upsertNotificationChannel` | `{ channel_type, config, secret?, is_enabled }` | `{ success, data }` (secret → Vault) | `settings.notifications.manage` | — | `/admin/settings` |
| `testNotificationChannel` | `{ channel_type }` | `{ success }` — verifies Vault round-trip, marks verified | `settings.notifications.manage` | — | `/admin/settings` |
| `getDocumentSequences` | — | `{ data }` (BigInt → number) | `settings.sequences.manage` | — | — |
| `upsertDocumentSequence` | `SequenceUpsertInput` | `{ success }` | `settings.sequences.manage` | — | `/admin/settings` |
| `previewNextNumber` | `SequenceUpsertInput` | `{ data: "INV-2026-00042" }` (non-consuming) | `settings.sequences.manage` | — | — |
| `getTenantFeatures` | — | `{ data: FeatureDecision[] }` | `settings.features.read` | — | — |
| `getMyPreferences` | — | `{ data: ResolvedSetting[] }` (user-scope keys) | self | — | — |
| `updateMyPreferences` | `{ updates }` (user-scope keys only) | `{ success }` | self | `settings:user:{tid}:{pid}` | `/settings/preferences` |

## Platform actions — `src/app/actions/app-owner/settings.ts` (all `requireAppOwner()`)

| Action | Purpose |
|---|---|
| `getGlobalSettings` | Raw `global_settings` rows grouped by category (legacy read, kept) |
| `getPlatformSettingsOverview` | Platform-scope definitions merged with current values (editor data) |
| `updateGlobalSettings` | Validated platform writes (requires a matching definition; history scope `platform`) |
| `getSettingDefinitions` / `upsertSettingDefinition` | Definitions catalog CRUD (invalidates `settings:defs`) |
| `getFeatureFlags` / `upsertFeatureFlag` | Flag catalog incl. kill switch (tenant caches expire by TTL ≤120s) |
| `setTenantFeatureOverride` | Per-tenant grant/block, optional expiry (invalidates that tenant's feature cache) |
| `upsertGlobalLookupValue` / `upsertGlobalTemplate` | Global default rows (`tenant_id NULL`) |

## Consumer facades

- `src/lib/settings.ts` — `getSetting<T>`, `getModuleSettings`, `getAppointmentSettings`, `getWorkingHours`, `getLocalization`, `getPublicSettings`. Wired consumers: appointment creation/cancellation in `src/app/actions/admin.ts` enforce working hours, slot alignment, lead time, advance window, and the cancellation window via `src/features/settings/domain/booking-policy.ts`.
- `src/lib/features.ts` — `hasFeature`, `requireFeature`, `getFeatureDecisions`. Evaluation chain: `kill_switch > environment > tenant_override (unexpired) > plan entitlement (subscription_features, with legacy plan-string fallback) > default_enabled`; unknown keys are **false**. UI counterpart: `<FeatureGuard feature="...">` (`src/components/auth/FeatureGuard.tsx`); nav items support `requiredFeature`.
- `sequenceService.claim(tenantId, "invoice")` — atomic number claim for future invoice-creation flows (existing invoices were backfilled by migration 11).

## Testing

`npx vitest run` — suites under `src/features/settings/__tests__/`:

- `resolution.test.ts` — precedence (user > tenant > platform > default), `allowed_scopes`, stale-value fallback, masking, public filtering.
- `validation.test.ts` — `zodFromDefinition` per value_type incl. `weekly_schedule` and rule JSON (min/max/enum/pattern/itemKeys).
- `sequences.test.ts` — period keys, formatting, non-consuming preview, config upsert routing. (DB-level claim atomicity lives in the SQL function, not unit tests.)
- `templates.test.ts` — fallback chain (tenant+locale → tenant+en → global+locale → global+en), `{{var}}` rendering, missing-variable reporting.
- `features.test.ts` — kill-switch dominance, environment gate, expired overrides, plan entitlement, legacy fallback, deny-by-default.
- `booking-policy.test.ts` — lead time, advance window, closed days, working-hours bounds, slot alignment, cancellation window.
