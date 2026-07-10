// src/app/(dashboard)/settings/roles/[id]/page.tsx
"use client";

import React, { use, useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRoleDetailsAction, getProfilesAction, deleteRoleAction } from "@/features/rbac/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PermissionBadge } from "@/features/rbac/components/PermissionBadge";
import { ArrowLeft, Edit, Trash, Calendar, Users, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RoleDetailPage({ params }: PageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Unwrap params using React.use()
  const { id: roleId } = use(params);

  // Query role details
  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["rbacRoleDetails", roleId],
    queryFn: async () => {
      const res = await getRoleDetailsAction(roleId);
      if (res.error) throw new Error(res.error);
      return res.data;
    }
  });

  // Query profiles to find assigned users
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["rbacProfiles"],
    queryFn: async () => {
      const res = await getProfilesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await deleteRoleAction(roleId);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacRoles"] });
      toast.success("Role deleted successfully");
      router.push("/settings/roles");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete role");
    }
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete role '${role?.name}'?`)) {
      deleteMutation.mutate();
    }
  };

  if (roleLoading || profilesLoading) {
    return <div className="py-24 text-center text-mute text-sm">Loading details...</div>;
  }

  if (!role) {
    return (
      <div className="py-24 text-center text-rose-500 font-mono text-sm">
        Role not found. Link is invalid or role was deleted.
      </div>
    );
  }

  // Filter profiles mapped to this role
  const assignedUsers = profiles.filter((p: any) =>
    p.user_roles.some((ur: any) => ur.roles.id === roleId)
  );

  return (
    <div className="space-y-6 font-inter max-w-5xl mx-auto">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/settings/roles")} className="h-9 w-9 border-hairline">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{role.name}</h1>
              {role.is_system && (
                <Badge variant="secondary" className="bg-sky-500/10 text-sky-500 border-sky-500/20 text-[10px] uppercase font-mono py-0">
                  System
                </Badge>
              )}
            </div>
            <p className="text-mute text-xs mt-0.5">View details, permissions, and assigned staff for this role.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/settings/roles/edit?id=${roleId}`)}
            className="h-9 text-xs flex gap-1.5"
          >
            <Edit className="h-3.5 w-3.5" /> Edit Role
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={role.is_system || deleteMutation.isPending}
            className="h-9 text-xs flex gap-1.5 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
          >
            <Trash className="h-3.5 w-3.5" /> Delete Role
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left col - Details & Users */}
        <div className="space-y-4 md:col-span-1">
          <Card className="bg-surface border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight text-ink uppercase">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-mono text-mute">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <span>Created: {new Date(role.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span>Assigned Staff: {assignedUsers.length}</span>
              </div>
              <Separator />
              <p className="font-sans leading-relaxed text-[13px]">{role.description || "No description provided."}</p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight text-ink uppercase">Assigned Users ({assignedUsers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignedUsers.length === 0 ? (
                <div className="p-4 text-xs text-mute italic">No users mapped to this role.</div>
              ) : (
                <div className="divide-y divide-hairline">
                  {assignedUsers.map((user: any) => (
                    <div key={user.id} className="p-3 flex flex-col gap-0.5 text-xs font-mono">
                      <span className="font-semibold text-ink">{user.full_name || "Unnamed"}</span>
                      <span className="text-[10px] text-mute">{user.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right col - Permissions mapped */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-ink uppercase">Assigned Permissions ({role.permissions?.length || 0})</h3>
          {role.permissions?.length === 0 ? (
            <div className="py-12 text-center text-xs text-mute border border-dashed border-hairline rounded-md">
              No permissions explicitly assigned to this role.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {role.permissions?.map((p: any) => {
                const action = p.name.split(".").pop() || p.name;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-md border p-3 text-xs bg-surface ${
                      p.is_deny ? "border-rose-500/20 bg-rose-500/5 text-rose-500" : "border-hairline"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono truncate">
                      {p.is_deny && <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />}
                      <span className="truncate text-ink font-medium">{p.name}</span>
                    </div>
                    <PermissionBadge action={action} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
