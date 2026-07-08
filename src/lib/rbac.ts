// src/lib/rbac.ts
import { evaluationService } from "@/features/rbac/services/evaluation.service";
import { getTenantInfo } from "@/lib/auth";

/**
 * Profile roles that bypass tenant permission checks. `owner`/`admin` are the
 * tenant super-users (they share full management permissions per product spec);
 * `app_owner` is the platform operator. This is the single source of truth for
 * the bypass identity — `lib/permissions.ts` and `lib/subscription.ts` delegate
 * here so all entry points agree (previously each used a different string).
 */
const BYPASS_PROFILE_ROLES = new Set(["owner", "admin", "app_owner"]);

export function isBypassRole(role?: string | null): boolean {
  return !!role && BYPASS_PROFILE_ROLES.has(role);
}

export async function hasPermission(permissionName: string): Promise<boolean> {
  const tenant = await getTenantInfo();
  if (!tenant || !tenant.clinicId) return false;

  if (isBypassRole(tenant.role)) return true;

  const result = await evaluationService.evaluatePermission(
    tenant.clinicId,
    tenant.profileId,
    permissionName
  );
  return result.allowed;
}

export async function getUserPermissions(): Promise<string[]> {
  const tenant = await getTenantInfo();
  if (!tenant || !tenant.clinicId) return [];
  return evaluationService.getUserActivePermissions(tenant.clinicId, tenant.profileId);
}

export async function getUserRoles(): Promise<string[]> {
  const tenant = await getTenantInfo();
  if (!tenant || !tenant.clinicId) return [];
  const { rbacService } = await import("@/features/rbac/services/rbac.service");
  const roles = await rbacService.getUserRoles(tenant.clinicId, tenant.profileId);
  return (roles as Array<{ roles: { name: string } }>).map((ur) => ur.roles.name);
}
