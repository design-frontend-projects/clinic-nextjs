# Settings Module — Security Model

## Enforcement layers

1. **Server actions (primary)** — every action calls `requireTenantInfo()` (tenant scoping) and `requirePermission("settings.…")` before touching data; every query filters by `tenant_id`/`profile_id`. Platform actions require `requireAppOwner()` (`profiles.role === "app_owner"`).
2. **Zod validation** — action inputs are `safeParse`d; setting values are additionally validated against their definition (`zodFromDefinition`) on write *and re-validated on read*.
3. **Row Level Security (defense-in-depth only)** — every table has RLS policies mirroring the action-layer rules, using `auth.current_tenant_id()` / `auth.is_super_admin()`. **Caveat (unchanged from the rest of the app):** the app's Prisma pool connects directly and bypasses RLS; RLS protects direct PostgREST/SQL access paths only. Never rely on RLS instead of action-layer scoping.

## Permission matrix

| Permission | Grants | Default roles (seeded) |
|---|---|---|
| `settings.core.read` | View tenant settings; also gates the sidebar item | Owner, Admin, Super Admin, Manager |
| `settings.core.manage` | Edit settings, export/import | Owner, Admin, Super Admin |
| `settings.lookups.manage` | Manage lookup values | Owner, Admin, Super Admin |
| `settings.notifications.manage` | Templates + channels (incl. secrets) | Owner, Admin, Super Admin |
| `settings.sequences.manage` | Document numbering config + previews | Owner, Admin, Super Admin |
| `settings.history.read` | View change history | Owner, Admin, Super Admin, Manager |
| `settings.history.rollback` | Roll back a change | Owner, Admin, Super Admin |
| `settings.features.read` | View evaluated feature flags | Owner, Admin, Super Admin, Manager |
| *(app-owner tier)* | Definitions, platform values, flags, overrides, global lookups/templates | `app_owner` profile role only |

User preferences (`getMyPreferences`/`updateMyPreferences`) are **self-scoped** — no extra permission; the engine enforces `'user' ∈ allowed_scopes` per key, and rows are keyed by the caller's own `profile_id`.

Note: `owner`/`admin`/`app_owner` profile roles bypass `hasPermission()` (existing app-wide behavior in `src/lib/rbac.ts`). Feature flags deliberately have **no role bypass** — entitlements describe the tenant's plan, not the caller.

## Secrets (Supabase Vault)

- Plaintext secrets (SMTP passwords, API keys) are accepted **only** as action inputs, immediately written to Supabase Vault via `vault.create_secret()` / `vault.update_secret()` (parameterized `$queryRaw`), and referenced by UUID (`secret_ref` / `vault_secret_id`). Tables never store ciphertext or plaintext.
- Secret naming: `tenant:{tenantId}:channel:{channelType}` / `tenant:{tenantId}:setting:{key}` for traceability.
- **Reads never return secrets.** Channel reads map `secret_ref` → `{ hasSecret: boolean }`; sensitive settings resolve to `{ masked: true, hasValue }`; history and audit rows store masked values; sensitive keys are excluded from export and rollback. Decryption (`vault.decrypted_secrets`) happens only server-side, in `testNotificationChannel` and the future notification sender.
- **Grant risk & contingency:** the `DATABASE_URL` role needs the grants in `12_notifications.sql` §4 (wrapped in a non-fatal DO block). Verify after migrating with `VaultSecretStore.isAvailable()` (a `SELECT ... LIMIT 0` against `vault.decrypted_secrets` through the app connection). If grants are impossible on a pooled role, implement `ISecretStore` (`src/features/settings/services/vault.service.ts`) with Node `crypto` AES-256-GCM keyed by a `SETTINGS_ENCRYPTION_KEY` env var — a one-file swap.

## Audit guarantees

Every mutation produces **two** records:

1. `settings_history` — append-only per-key old/new values + version (no UPDATE/DELETE policies exist; rollback writes forward, never rewrites).
2. `audit_logs` via the existing `auditService.logChange()` — actions `settings.updated`, `settings.lookup.updated|deleted`, `settings.template.updated`, `settings.channel.updated`, `settings.sequence.updated`, with actor id/email, IP, user agent, and device, visible in the existing `/settings/audit` UI.

## Input-hardening notes

- Bulk updates are capped (100 keys) and applied all-or-nothing in a transaction; import validates every entry before writing anything.
- Lookup/template writes go through find-then-write in transactions, so the partial unique indexes are the final integrity backstop against races.
- Public surface (`getPublicSettings`) returns only `is_public` and non-sensitive definitions for an explicit tenant id.
