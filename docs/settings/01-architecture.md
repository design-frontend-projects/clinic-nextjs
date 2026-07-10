# Enterprise Global Settings Module — Architecture

> Companion docs: [02-data-model.md](./02-data-model.md) · [03-security.md](./03-security.md) · [04-api-reference.md](./04-api-reference.md)

## Overview

A centralized, layered configuration system for the multi-tenant clinic SaaS. It provides:

- **Platform settings** — app-owner-managed values in the existing `global_settings` table.
- **Tenant settings** — per-clinic configuration (`tenant_settings`).
- **User preferences** — per-profile values (`user_settings`) that follow the user across devices.
- **Module settings** — every key belongs to a module (`organization`, `localization`, `branding`, `working_hours`, `appointments`, `notifications`, `billing`, `preferences`, `platform`); new modules are added by seeding definitions, with **no schema changes**.
- Supporting subsystems: **lookups** (tenant-shadowed value lists), **feature flags** (plan-entitlement-aware), **document sequences** (atomic numbering), **notification templates + channels** (bilingual, Vault-backed secrets), **history/rollback**, **export/import**.

## Layering (mirrors `src/features/rbac/`)

```
src/features/settings/
├── domain/          dtos.ts (Zod), models.ts (types), validation.ts (zodFromDefinition),
│                    booking-policy.ts (pure policy checks)
├── repositories/    settings.repository.ts (all Prisma access, tx-aware)
├── services/        settings.service.ts (orchestration: validate → write → history → audit → cache)
│                    resolution.service.ts (pure layered merge)
│                    feature.service.ts, lookup.service.ts, template.service.ts,
│                    sequence.service.ts, cache.service.ts, vault.service.ts (ISecretStore)
├── actions.ts       "use server" tenant + user API surface
├── components/      tenant settings tabs + preferences UI
└── __tests__/       vitest suites (103 tests incl. RBAC)
```

App code consumes settings through two facades only:

- `src/lib/settings.ts` — `getSetting<T>(key)`, `getModuleSettings(module)`, `getAppointmentSettings()`, `getWorkingHours()`, `getLocalization()`, `getPublicSettings(tenantId)`.
- `src/lib/features.ts` — `hasFeature(key)`, `requireFeature(key)`, `getFeatureDecisions()`.

Platform-scope actions live in `src/app/actions/app-owner/settings.ts` (guarded by `requireAppOwner()`).

## Configuration hierarchy & resolution algorithm

Every key is declared once in **`setting_definitions`** (type, default, validation rules, `allowed_scopes`, sensitivity, public visibility). Resolution per key:

```
user_settings value        (only if 'user'     ∈ allowed_scopes)
> tenant_settings value    (only if 'tenant'   ∈ allowed_scopes)
> global_settings value    (matched by key; only if 'platform' ∈ allowed_scopes)
> setting_definitions.default_value
```

Two hardening rules (see `resolution.service.ts`):

1. **Re-validation on read** — every candidate value is re-parsed through the definition's Zod schema (`zodFromDefinition`). A stale value that no longer matches the definition falls through to the next layer instead of leaking.
2. **Sensitive masking** — `is_sensitive` definitions always resolve to `{ masked: true, hasValue }`; plaintext never leaves the server (see 03-security.md).

Because defaults are seeded for every key, resolution **never fails** for an unconfigured tenant.

## Caching

In-memory TTL cache per server process (`SettingsCacheService`, reusing the RBAC `ICacheStore` contract):

| Key | TTL |
|---|---|
| `settings:defs` | 600s |
| `settings:platform` | 300s |
| `settings:tenant:{tenantId}` | 300s |
| `settings:user:{tenantId}:{profileId}` | 120s |
| `lookups:{tenantId}:{category}` | 300s |
| `features:{tenantId}` | 120s |
| `templates:{tenantId}` | 600s |

Writes invalidate the exact scope key (definition edits also invalidate `settings:defs`). React `cache()` deduplicates reads within one request. **Accepted limitation** (same as RBAC): the cache is per-instance; cross-instance staleness is bounded by TTL. `ICacheStore` is the seam for a Redis swap with zero service-code changes.

## Scalability notes

- All value tables are keyed tenant-first with tenant-first indexes; reads are 3 indexed queries (defs + tenant + user) amortized by cache.
- `settings_history` is append-only and index-covered (`(tenant_id, definition_key, changed_at DESC)`); prune or partition by `changed_at` if it grows into millions of rows.
- Document numbering scales via single-row `INSERT … ON CONFLICT DO UPDATE` locks — no table locks, no app-level coordination (see 02-data-model.md).
- Feature evaluation is one cached read per tenant per 120s regardless of flag count.

## Extensibility — add a new setting in 3 steps

1. **Seed a definition** (SQL in the next migration, or the app-owner Definitions UI):
   ```sql
   INSERT INTO setting_definitions (key, module, category, value_type, default_value, validation, allowed_scopes, description, display_order)
   VALUES ('pharmacy.allow_negative_stock', 'pharmacy', 'stock', 'boolean', 'false', NULL, '{tenant}', 'Allow stock to go below zero', 10)
   ON CONFLICT (key) DO NOTHING;
   ```
2. **Read it** where needed: `const allow = await getSetting<boolean>("pharmacy.allow_negative_stock")`.
3. **(Optional) surface it** in the tenant UI — either add a field to an existing tab component or a new tab in `TenantSettingsTabs.tsx`.

No table changes, no new actions, validation/history/rollback/audit/caching all apply automatically. Adding a whole new module = seeding definitions with a new `module` value.

## Runtime-store integration (theme & language)

The DB is the **cross-device source of truth**; `next-themes` (localStorage) and `next-intl` (cookie/URL) remain the **runtime drivers**:

- Saving preferences applies the runtime mechanism immediately (`setTheme`, locale `router.replace`) *and* persists via `updateMyPreferences`.
- `PreferencesBootstrap` (mounted in the dashboard layout) applies the DB theme **only when localStorage has none**, and the DB language **only when no `NEXT_LOCALE` cookie exists** — fresh devices inherit, local choices always win afterwards. The two stores never fight.

## Feature gating consolidation

Previously two decoupled mechanisms existed: the `clinics.subscription_plan` string (enforced by `src/lib/subscription.ts`) and `subscription_features` rows (displayed only). The module consolidates on one evaluation chain (`src/lib/features.ts`):

```
kill_switch  >  environment gate  >  tenant override (unexpired)
             >  plan entitlement (subscription_features — now enforced)
             >  flag default_enabled
```

Legacy fallback: tenants without a `tenant_subscriptions` row resolve their plan by matching the legacy string against plan names. `requireSubscription()`/`hasSubscription()` remain as `@deprecated` shims. `clinics.have_pharmacy`/`have_lab` stay as ops toggles (future consolidation candidate).
