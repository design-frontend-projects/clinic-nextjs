import { hasPermission as rbacHasPermission } from "@/lib/rbac";

/**
 * Thin, throwing wrapper over the single permission entry point in `lib/rbac`.
 * Kept for call-site compatibility; the bypass identity lives in `lib/rbac`.
 */
export async function requirePermission(permissionName: string): Promise<true> {
  const allowed = await rbacHasPermission(permissionName);
  console.log('is user allowed');
  console.log(allowed);
  if (!allowed) {
    throw new Error(`Forbidden: Missing required permission (${permissionName})`);
  }
  return true;
}

/**
 * Non-throwing permission check. Delegates to `lib/rbac.hasPermission` so the
 * admin-bypass rule is consistent everywhere.
 */
export async function hasPermission(permissionName: string): Promise<boolean> {
  return rbacHasPermission(permissionName);
}
