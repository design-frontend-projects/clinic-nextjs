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



