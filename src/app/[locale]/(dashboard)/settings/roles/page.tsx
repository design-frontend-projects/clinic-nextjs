// src/app/(dashboard)/settings/roles/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Plus, Shield, ArrowLeft, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRolesAction,
  getRoleHierarchyAction,
  deleteRoleAction,
  cloneRoleAction,
  toggleRoleActiveAction,
  addRoleHierarchyLinkAction,
  removeRoleHierarchyLinkAction
} from "@/features/rbac/actions";
import { RoleCard } from "@/features/rbac/components/RoleCard";
import { RoleHierarchyTree } from "@/features/rbac/components/RoleHierarchyTree";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function RolesSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Queries
  const { data: rolesData, isLoading: rolesLoading, refetch: refetchRoles } = useQuery({
    queryKey: ["rbacRoles"],
    queryFn: async () => {
      const res = await getRolesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const { data: hierarchyData, isLoading: hierarchyLoading, refetch: refetchHierarchy } = useQuery({
    queryKey: ["rbacHierarchy"],
    queryFn: async () => {
      const res = await getRoleHierarchyAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  // Mutations
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ roleId, isActive }: { roleId: string; isActive: boolean }) => {
      const res = await toggleRoleActiveAction(roleId, isActive);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacRoles"] });
      toast.success("Role status toggled successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to toggle role status");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await deleteRoleAction(roleId);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacRoles"] });
      queryClient.invalidateQueries({ queryKey: ["rbacHierarchy"] });
      toast.success("Role deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete role");
    }
  });

  const cloneMutation = useMutation({
    mutationFn: async ({ roleId, name }: { roleId: string; name: string }) => {
      const res = await cloneRoleAction(roleId, name);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacRoles"] });
      toast.success("Role cloned successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to clone role");
    }
  });

  const addHierarchyMutation = useMutation({
    mutationFn: async ({ parentId, childId }: { parentId: string; childId: string }) => {
      const res = await addRoleHierarchyLinkAction({ parentRoleId: parentId, childRoleId: childId });
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacHierarchy"] });
      toast.success("Inheritance mapping added successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link roles in hierarchy");
    }
  });

  const removeHierarchyMutation = useMutation({
    mutationFn: async ({ parentId, childId }: { parentId: string; childId: string }) => {
      const res = await removeRoleHierarchyLinkAction(parentId, childId);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacHierarchy"] });
      toast.success("Inheritance mapping removed successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove inheritance mapping");
    }
  });

  const handleEdit = (role: any) => {
    router.push(`/settings/roles/edit?id=${role.id}`);
  };

  const handleClone = (role: any) => {
    const newName = window.prompt(`Enter new name for cloned role:`, `Copy of ${role.name}`);
    if (newName && newName.trim()) {
      cloneMutation.mutate({ roleId: role.id, name: newName.trim() });
    }
  };

  const handleDelete = (role: any) => {
    if (window.confirm(`Are you sure you want to delete role '${role.name}'?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  const handleToggleActive = (role: any, isActive: boolean) => {
    toggleActiveMutation.mutate({ roleId: role.id, isActive });
  };

  const isLoading = rolesLoading || hierarchyLoading;

  return (
    <div className="space-y-6 font-inter max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" /> Role Management
          </h1>
          <p className="text-mute text-sm mt-1">
            Configure clinic-wide security roles, assign default permissions, and design inheritance hierarchies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              refetchRoles();
              refetchHierarchy();
            }}
            disabled={isLoading}
            className="h-9 w-9 border-hairline"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          <Button asChild className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/settings/roles/create" className="flex gap-1.5">
              <Plus className="h-4 w-4" /> Create Role
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Roles Cards grid */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold tracking-tight text-ink uppercase">Active Roles</h3>
          {rolesLoading ? (
            <div className="py-24 text-center text-sm text-mute">Loading roles...</div>
          ) : rolesData && rolesData.length === 0 ? (
            <div className="py-24 text-center text-sm text-mute border border-dashed border-hairline rounded-md">
              No roles configured yet. Click Create Role to get started.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rolesData?.map((role: any) => (
                <div key={role.id} onClick={() => router.push(`/settings/roles/${role.id}`)} className="cursor-pointer">
                  <RoleCard
                    role={role}
                    permissionsCount={role.role_permissions?.length || 0}
                    onEdit={(e) => {
                      e.stopPropagation();
                      handleEdit(role);
                    }}
                    onClone={(e) => {
                      e.stopPropagation();
                      handleClone(role);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      handleDelete(role);
                    }}
                    onToggleActive={(e, role, active) => {
                      e.stopPropagation();
                      handleToggleActive(role, active);
                    }}
                    isLoading={isLoading}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Hierarchy Manager */}
        <div>
          <RoleHierarchyTree
            links={hierarchyData || []}
            availableRoles={rolesData || []}
            onAddLink={async (parent, child) => {
              addHierarchyMutation.mutate({ parentId: parent, childId: child });
            }}
            onRemoveLink={async (parent, child) => {
              removeHierarchyMutation.mutate({ parentId: parent, childId: child });
            }}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
