// src/app/(dashboard)/settings/permissions/page.tsx
"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRolesAction,
  getPermissionsAction,
  getRoleHierarchyAction,
  getRolePermissionsMatrixDataAction,
  setRolePermissionCellAction
} from "@/features/rbac/actions";
import { PermissionMatrix } from "@/features/rbac/components/PermissionMatrix";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PermissionsSettingsPage() {
  const queryClient = useQueryClient();

  // Queries
  const { data: roles = [], isLoading: rolesLoading, refetch: refetchRoles } = useQuery({
    queryKey: ["rbacRoles"],
    queryFn: async () => {
      const res = await getRolesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const { data: permissions = [], isLoading: permissionsLoading, refetch: refetchPermissions } = useQuery({
    queryKey: ["rbacPermissions"],
    queryFn: async () => {
      const res = await getPermissionsAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const { data: hierarchy = [], isLoading: hierarchyLoading, refetch: refetchHierarchy } = useQuery({
    queryKey: ["rbacHierarchy"],
    queryFn: async () => {
      const res = await getRoleHierarchyAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const { data: rolePermissions = [], isLoading: rpLoading, refetch: refetchRP } = useQuery({
    queryKey: ["rbacMatrixData"],
    queryFn: async () => {
      const res = await getRolePermissionsMatrixDataAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  // Cell Update Mutation
  const saveCellMutation = useMutation({
    mutationFn: async ({
      roleId,
      permissionId,
      state
    }: {
      roleId: string;
      permissionId: string;
      state: "allow" | "deny" | "none";
    }) => {
      const res = await setRolePermissionCellAction(roleId, permissionId, state);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacMatrixData"] });
      toast.success("Permissions updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update permission mapping");
    }
  });

  const isLoading = rolesLoading || permissionsLoading || hierarchyLoading || rpLoading;

  const handleRefresh = () => {
    refetchRoles();
    refetchPermissions();
    refetchHierarchy();
    refetchRP();
  };

  return (
    <div className="space-y-6 font-inter max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" /> Permission Matrix
          </h1>
          <p className="text-mute text-sm mt-1">
            Map clinical and administrative permissions across all system roles. Changes apply instantly.
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
          className="h-9 w-9 border-hairline"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <div className="py-32 text-center text-sm text-mute">Loading permission matrix...</div>
      ) : (
        <PermissionMatrix
          roles={roles}
          permissions={permissions}
          rolePermissions={rolePermissions}
          hierarchyLinks={hierarchy}
          onSaveCell={async (roleId, permissionId, state) => {
            saveCellMutation.mutate({ roleId, permissionId, state });
          }}
          isLoading={saveCellMutation.isPending}
        />
      )}
    </div>
  );
}
