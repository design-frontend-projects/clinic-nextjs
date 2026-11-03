# ERRORS.md - Automatic Error Tracking & Learning

## [2026-07-01 20:35] - EvaluationService does not have dedupedPermissionCheck

- **Type**: Logic
- **Severity**: High
- **File**: `src/features/rbac/middleware.ts:57`
- **Agent**: @debugger
- **Root Cause**: The method `dedupedPermissionCheck` is defined in `CacheService` (`cache.service.ts`), but was incorrectly invoked on `EvaluationService` (`evaluation.service.ts`) in the middleware.
- **Error Message**: 
  ```
  Property 'dedupedPermissionCheck' does not exist on type 'EvaluationService'.
  ```
- **Fix Applied**: Imported `cacheService` in `middleware.ts` and updated all `evaluationService.dedupedPermissionCheck` calls to `cacheService.dedupedPermissionCheck`.
- **Prevention**: Ensure that services targeting request-level memoization/caching are correctly imported and typed.
- **Status**: Fixed

---

## [2026-07-01 20:39] - Property 'audit' is private and only accessible within class 'RBACService'

- **Type**: Syntax
- **Severity**: Medium
- **File**: `src/features/rbac/actions.ts:256`
- **Agent**: @debugger
- **Root Cause**: The `audit` property (referencing `auditService`) in `RBACService`'s constructor was defined as `private`, preventing the server action `getAuditLogsAction` in `actions.ts` from invoking `rbacService.audit.getLogs(...)`.
- **Error Message**: 
  ```
  Property 'audit' is private and only accessible within class 'RBACService'.
  ```
- **Fix Applied**: Changed the modifier of `audit` in the `RBACService` constructor from `private` to `public readonly`.
- **Prevention**: Declare constructor properties intended for external/action consumption as `public` or `public readonly`.
- **Status**: Fixed

---

## [2026-10-30 00:05] - Cannot find module '.prisma/client/default' in Next.js 16 (Turbopack)

- **Type**: Integration
- **Severity**: High
- **File**: `src/lib/prisma.ts:1`
- **Agent**: @debugger
- **Root Cause**: Prisma 7 (`@prisma/client@7.4.2`) no longer includes an automatic `postinstall` script in its package, and `pnpm-workspace.yaml` had placeholder strings (`set this to true or false`) under `allowBuilds`. Running `pnpm install` recreated the `@prisma/client` virtual store folder without regenerating `.prisma/client/default`.
- **Error Message**: 
  ```
  Failed to load external module @prisma/client-8bf6e2af8d9667ab: Error: Cannot find module '.prisma/client/default'
  ```
- **Fix Applied**: Configured boolean values in `pnpm-workspace.yaml` `allowBuilds`, added `"postinstall": "prisma generate"` and `prisma generate` prefixes to `dev` and `build` in `package.json`, switched `prisma.config.ts` to `process.env.DIRECT_URL` so `prisma generate` works without requiring `DIRECT_URL` at install/build time, updated `Dockerfile` `deps` stage with `--ignore-scripts`, and regenerated the Prisma Client.
- **Prevention**: Ensure `postinstall`, `dev`, and `build` scripts always run `prisma generate` and keep `pnpm-workspace.yaml` `allowBuilds` values as valid booleans.
- **Status**: Fixed

---

## [2026-10-30 00:35] - MISSING_MESSAGE: Could not resolve `pages.admin` in messages for locale `en`

- **Type**: Runtime
- **Severity**: High
- **File**: `src/messages/en.json`, `src/messages/ar.json`, `src/messages/fr.json`
- **Agent**: @frontend-specialist
- **Root Cause**: During commit `9ca2eda41059fdd341c177af339deb4da15e8dc6`, the `pages.admin` namespace and the top-level keys of `pages.staff` were accidentally overwritten when adding `pages.doctor`, `pages.patient`, and `pages.staff.patients` to `src/messages/*.json`. Additionally, `pages.doctor.consultation` insurance tab keys and `plans.continueToSetup` were missing across locales, and `admin.billing` / `admin.appointments` had corrupted encoding in `ar.json` and `fr.json`.
- **Error Message**: 
  ```
  MISSING_MESSAGE: Could not resolve `pages.admin` in messages for locale `en`.
      at AdminDashboardClient (src/app/[locale]/(dashboard)/admin/_components/admin-dashboard-client.tsx:65:28)
      at AdminDashboard (src/app/[locale]/(dashboard)/admin/page.tsx:31:10)
  ```
- **Fix Applied**: Restored `pages.admin` (including table column keys `patient`, `doctor`, `date`, `status`) and top-level `pages.staff` keys in `en.json`, `ar.json`, and `fr.json`; added missing `pages.doctor.consultation` insurance keys, `plans.continueToSetup`, `header.french`, and `sidebar.messages`; repaired corrupted characters in `ar.json` and `fr.json`; restored the missing localized `columns` definition in `src/app/[locale]/(dashboard)/admin/patients/page.tsx`; and added an automated Vitest suite (`src/lib/__tests__/i18n-messages.test.ts`) to enforce namespace/key resolution and locale parity.
- **Prevention**: Run `src/lib/__tests__/i18n-messages.test.ts` whenever modifying locale JSON files or adding `useTranslations` / `getTranslations` calls.
- **Status**: Fixed



---

## [2026-10-30 01:28] - Unknown argument `consultation_deduction_type` in `prisma.insurance_providers.updateMany()`

- **Type**: Runtime / Integration
- **Severity**: High
- **File**: `src/lib/prisma.ts:18`, `prisma/migrations/23_billing_catalog_and_insurance.sql:59`
- **Agent**: @debugger & @database-architect
- **Root Cause**:
  1. In development (`next dev` with Turbopack), `globalForPrisma.prismaBase` in `src/lib/prisma.ts` cached the `PrismaClient` instance across HMR reloads, and Node's CommonJS `require.cache` retained the pre-`prisma generate` `.prisma/client` runtime data model (`_runtimeDataModel`), which lacked the newly added `consultation_deduction_type`, `lab_deduction_type`, `pharmacy_deduction_type` fields and `billing_catalog_items` delegate.
  2. Additionally, `prisma/migrations/23_billing_catalog_and_insurance.sql` had not yet been applied to the PostgreSQL database and referenced `auth.current_tenant_id()` / `auth.is_super_admin()` helper functions instead of the direct `profiles` subquery pattern used by the target database.
- **Error Message**: 
  ```
  `__TURBOPACK__imported__module__...["prisma"].insurance_providers.updateMany()` invocation
  Unknown argument `consultation_deduction_type`. Available options are marked with ?.
  ```
- **Fix Applied**:
  1. Updated RLS policies in `prisma/migrations/23_billing_catalog_and_insurance.sql` to use `profiles` subqueries matching `22_whatsapp_messaging.sql`, and executed the migration against PostgreSQL so `billing_catalog_items`, `invoice_items` (`catalog_item_id`, `category`), and `insurance_providers` (`consultation_deduction_type`, `consultation_deduction_value`, `lab_deduction_type`, `lab_deduction_value`, `pharmacy_deduction_type`, `pharmacy_deduction_value`) are present in the live database.
  2. Updated `src/lib/prisma.ts` with `hasCurrentSchema()` and `createPrismaClient()` so that if `globalForPrisma.prismaBase` or the CJS `@prisma/client` cache holds a stale schema in development, it automatically invalidates the cached `.prisma/client` module and instantiates a fresh `PrismaClient`.
- **Prevention**: Whenever adding models or columns to `prisma/schema.prisma`, always apply the corresponding SQL migration to the target database immediately after `pnpm prisma generate` and ensure `src/lib/prisma.ts` validates schema freshness for cached dev singletons.
- **Status**: Fixed
