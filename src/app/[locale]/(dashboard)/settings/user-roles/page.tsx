// src/app/(dashboard)/settings/user-roles/page.tsx
"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfilesAction, getRolesAction, assignUserRolesAction } from "@/features/rbac/actions";
import { UserRoleTable } from "@/features/rbac/components/UserRoleTable";
import { UserCog, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";

export default function UserRolesSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Queries
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["rbacProfiles"],
    queryFn: async () => {
      const res = await getProfilesAction();
      console.log("getProfilesAction response:", res);
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["rbacRoles"],
    queryFn: async () => {
      const res = await getRolesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async ({ profileId, roleIds }: { profileId: string; roleIds: string[] }) => {
      const res = await assignUserRolesAction({ profileId, roleIds });
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacProfiles"] });
      toast.success("Staff roles updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign roles");
    }
  });

  const isLoading = profilesLoading || rolesLoading;

  return (
    <div className="space-y-6 font-inter max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push("/settings/users")} className="h-9 w-9 border-hairline">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink flex items-center gap-2">
            <UserCog className="h-8 w-8 text-primary" /> Role Assignment
          </h1>
          <p className="text-mute text-sm mt-1">
            Map staff profiles to clinic roles. A single staff member can hold multiple roles simultaneously.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-sm text-mute">Loading mapping console...</div>
      ) : (
        <UserRoleTable
          profiles={profiles}
          availableRoles={roles}
          onAssignRoles={async (profileId, roleIds) => {
            await assignMutation.mutateAsync({ profileId, roleIds });
          }}
          isLoading={assignMutation.isPending}
        />
      )}
    </div>
  );
}
