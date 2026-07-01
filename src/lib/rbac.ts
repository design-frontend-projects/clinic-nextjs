// src/lib/rbac.ts
import { evaluationService } from "@/features/rbac/services/evaluation.service";
import { getTenantInfo } from "@/lib/auth";

export async function hasPermission(permissionName: string): Promise<boolean> {
  const tenant = await getTenantInfo();
  if (!tenant || !tenant.clinicId) return false;

  if (tenant.role === "Super Admin") return true;

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
