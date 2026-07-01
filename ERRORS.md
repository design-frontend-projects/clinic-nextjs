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

