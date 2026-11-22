// src/app/(dashboard)/settings/roles/[id]/page.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  deleteRoleAction,
  getProfilesAction,
  getRoleDetailsAction,
} from "@/features/rbac/actions";
import { PermissionBadge } from "@/features/rbac/components/PermissionBadge";
import { useRouter } from "@/i18n/routing";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Edit,
  ShieldAlert,
  Trash,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { use } from "react";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RoleDetailPage({ params }: PageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("settings.roles");

  // Unwrap params using React.use()
  const { id: roleId } = use(params);

  // Query role details
  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["rbacRoleDetails", roleId],
    queryFn: async () => {
      const res = await getRoleDetailsAction(roleId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
  });

  // Query profiles to find assigned users
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["rbacProfiles"],
    queryFn: async () => {
      const res = await getProfilesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await deleteRoleAction(roleId);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacRoles"] });
      toast.success(t("toastDeleted"));
      router.push("/settings/roles");
    },
    onError: (err: any) => {
      toast.error(err.message || t("toastDeleteFailed"));
    },
  });

  const handleDelete = () => {
    if (window.confirm(t("confirmDelete", { name: role?.name ?? "" }))) {
      deleteMutation.mutate();
    }
  };

  if (roleLoading || profilesLoading) {
    return (
      <div className="py-24 text-center text-muted-foreground text-sm">
        {t("loadingDetails")}
      </div>
    );
  }

  if (!role) {
    return (
      <div className="py-24 text-center text-rose-500 font-mono text-sm">
        {t("notFound")}
      </div>
    );
  }

  // Filter profiles mapped to this role
  const assignedUsers = profiles.filter((p: any) =>
    p.user_roles.some((ur: any) => ur.roles.id === roleId),
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/settings/roles")}
            className="h-9 w-9 border-hairline"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {role.name}
              </h1>
              {role.is_system && (
                <Badge
                  variant="secondary"
                  className="bg-sky-500/10 text-sky-500 border-sky-500/20 text-[10px] uppercase font-mono py-0"
                >
                  {t("systemBadge")}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              {t("detailSubtitle")}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/settings/roles/edit?id=${roleId}`)}
            className="h-9 text-xs flex gap-1.5"
          >
            <Edit className="h-3.5 w-3.5" /> {t("editRole")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={role.is_system || deleteMutation.isPending}
            className="h-9 text-xs flex gap-1.5 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
          >
            <Trash className="h-3.5 w-3.5" /> {t("deleteRole")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left col - Details & Users */}
        <div className="space-y-4 md:col-span-1">
          <Card className="bg-surface border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground uppercase">
                {t("metadataTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <span>
                  {t("createdAt", {
                    date: new Date(role.created_at).toLocaleDateString(),
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span>
                  {t("assignedStaffCount", { count: assignedUsers.length })}
                </span>
              </div>
              <Separator />
              <p className="font-sans leading-relaxed text-[13px]">
                {role.description || t("noDescription")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground uppercase">
                {t("assignedUsersTitle", { count: assignedUsers.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignedUsers.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground italic">
                  {t("noAssignedUsers")}
                </div>
              ) : (
                <div className="divide-y divide-hairline">
                  {assignedUsers.map((user: any) => (
                    <div
                      key={user.id}
                      className="p-3 flex flex-col gap-0.5 text-xs font-mono"
                    >
                      <span className="font-semibold text-foreground">
                        {user.full_name || t("unnamed")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right col - Permissions mapped */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
            {t("assignedPermissionsTitle", {
              count: role.permissions?.length || 0,
            })}
          </h3>
          {role.permissions?.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-hairline rounded-md">
              {t("noAssignedPermissions")}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {role.permissions?.map((p: any) => {
                const action = p.name.split(".").pop() || p.name;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-md border p-3 text-xs bg-surface ${
                      p.is_deny
                        ? "border-rose-500/20 bg-rose-500/5 text-rose-500"
                        : "border-hairline"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono truncate">
                      {p.is_deny && (
                        <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                      )}
                      <span className="truncate text-foreground font-medium">
                        {p.name}
                      </span>
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
