import React from "react";
import { hasPermission } from "@/lib/permissions";

interface PermissionGuardProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  matchAll?: boolean;
}

/**
 * A Server Component that conditionally renders its children based on
 * whether the current user has the required permissions.
 */
export async function PermissionGuard({
  permission,
  children,
  fallback = null,
  matchAll = false,
}: PermissionGuardProps) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  
  let hasAccess = false;
  
  if (matchAll) {
    // Must have all permissions
    const results = await Promise.all(permissions.map(p => hasPermission(p)));
    hasAccess = results.every(Boolean);
  } else {
    // Must have at least one permission
    for (const p of permissions) {
      if (await hasPermission(p)) {
        hasAccess = true;
        break;
      }
    }
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
