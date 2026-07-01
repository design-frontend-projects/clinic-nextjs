// src/features/rbac/hooks/useAuthorization.ts
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth-store";
import { useEffect } from "react";
import { getUserAuthorizationAction } from "../actions";

export function useAuthorization() {
  const store = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["currentUserAuthorization"],
    queryFn: async () => {
      const res = await getUserAuthorizationAction();
      if (res?.error) throw new Error(res.error);
      return res?.data ?? null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  useEffect(() => {
    if (data) {
      store.setAuthData({
        user: data.user,
        tenant: data.tenant,
        roles: data.roles,
        permissions: data.permissions,
      });
    } else if (error) {
      store.clearAuthData();
    }
    store.setLoading(isLoading);
  }, [data, isLoading, error]);

  const checkPermission = (permission: string): boolean => {
    if (store.roles.includes("Super Admin")) return true;

    const match = (assigned: string, required: string): boolean => {
      if (assigned === "*" || assigned === "manage") return true;
      if (assigned === required) return true;
      if (assigned.endsWith(".manage")) {
        const mod = assigned.slice(0, -7);
        if (required.startsWith(mod + ".")) return true;
      }
      if (assigned.endsWith(".*")) {
        const mod = assigned.slice(0, -2);
        if (required.startsWith(mod + ".")) return true;
      }
      return false;
    };

    return store.permissions.some((p) => match(p, permission));
  };

  return {
    user: store.user,
    tenant: store.tenant,
    roles: store.roles,
    permissions: store.permissions,
    isLoading: store.isLoading,
    checkPermission,
    refetch,
  };
}

export function usePermission(permission: string): boolean {
  const { checkPermission, isLoading } = useAuthorization();
  if (isLoading) return false;
  return checkPermission(permission);
}

export function usePermissions(permissions: string[]): Record<string, boolean> {
  const { checkPermission, isLoading } = useAuthorization();
  const results: Record<string, boolean> = {};
  for (const perm of permissions) {
    results[perm] = isLoading ? false : checkPermission(perm);
  }
  return results;
}

export function useRole(roleName: string): boolean {
  const { roles, isLoading } = useAuthorization();
  if (isLoading) return false;
  if (roles.includes("Super Admin")) return true;
  return roles.some((r) => r.toLowerCase() === roleName.toLowerCase());
}

export function useCurrentUser() {
  const { user, isLoading } = useAuthorization();
  return { user, isLoading };
}

export function useTenant() {
  const { tenant, isLoading } = useAuthorization();
  return { tenant, isLoading };
}
