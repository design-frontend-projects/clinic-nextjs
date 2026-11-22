// src/app/(dashboard)/settings/roles/edit/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PermissionTree } from "@/features/rbac/components/PermissionTree";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateRoleAction, getRoleDetailsAction, getPermissionsAction, getRolesAction } from "@/features/rbac/actions";
import { ArrowLeft, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";

function EditRoleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useTranslations("settings.roles");
  const roleId = searchParams.get("id");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentRoleId, setParentRoleId] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Queries
  const { data: permissions = [] } = useQuery({
    queryKey: ["rbacPermissions"],
    queryFn: async () => {
      const res = await getPermissionsAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["rbacRoles"],
    queryFn: async () => {
      const res = await getRolesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  const { data: roleDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["rbacRoleDetails", roleId],
    queryFn: async () => {
      if (!roleId) return null;
      const res = await getRoleDetailsAction(roleId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: !!roleId
  });

  // Sync state
  useEffect(() => {
    if (roleDetails) {
      setName(roleDetails.name);
      setDescription(roleDetails.description || "");
      setSelectedPermissionIds(roleDetails.permissions?.map((p: any) => p.id) || []);
      // We will read hierarchy links to resolve parent if requested
      setParentRoleId(null);
    }
  }, [roleDetails]);

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!roleId) throw new Error("Missing role ID");
      const res = await updateRoleAction(roleId, payload);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbacRoles"] });
      queryClient.invalidateQueries({ queryKey: ["rbacRoleDetails", roleId] });
      toast.success(t("toastUpdated"));
      router.push("/settings/roles");
    },
    onError: (err: any) => {
      setError(err.message || t("toastUpdateFailed"));
      toast.error(err.message || t("toastUpdateFailed"));
    }
  });

  const handleTogglePermission = (id: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("errNameRequired"));
      return;
    }

    updateMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      permissionIds: selectedPermissionIds,
      parentRoleId: parentRoleId === "none" ? null : parentRoleId
    });
  };

  if (!roleId) {
    return (
      <div className="py-24 text-center text-rose-500 font-mono text-sm">
        {t("missingRoleId")}
      </div>
    );
  }

  if (detailsLoading) {
    return <div className="py-24 text-center text-muted-foreground text-sm">{t("loadingDetails")}</div>;
  }

  const filteredRoles = roles.filter((r: any) => r.id !== roleId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/settings/roles")} className="h-9 w-9 border-hairline">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("editTitle", { name: roleDetails?.name ?? "" })}</h1>
            <p className="text-muted-foreground text-xs mt-0.5">{t("editSubtitle")}</p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex gap-1.5"
        >
          <Save className="h-4 w-4" /> {t("saveChanges")}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 font-mono flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left col - configs */}
        <div className="space-y-4 md:col-span-1">
          <Card className="bg-surface border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground uppercase">{t("detailsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="role_name" className="text-xs font-semibold text-foreground uppercase">{t("roleName")}</Label>
                <Input
                  id="role_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("editNamePlaceholder")}
                  disabled={roleDetails?.is_system || updateMutation.isPending}
                  className="h-9 border-hairline text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="parent_role" className="text-xs font-semibold text-foreground uppercase">{t("inheritsFrom")}</Label>
                <Select
                  value={parentRoleId || "none"}
                  onValueChange={(val) => setParentRoleId(val === "none" ? null : val)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id="parent_role" className="h-9 border-hairline text-sm">
                    <SelectValue placeholder={t("selectParent")} />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-hairline">
                    <SelectItem value="none" className="font-mono text-xs">{t("noneBaseRole")}</SelectItem>
                    {filteredRoles.map((r: any) => (
                      <SelectItem key={r.id} value={r.id} className="font-mono text-xs">{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role_desc" className="text-xs font-semibold text-foreground uppercase">{t("description")}</Label>
                <Textarea
                  id="role_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  rows={4}
                  className="border-hairline text-sm resize-none"
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right col - permission matrix/tree */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">{t("mapPermissions")}</h3>
          <PermissionTree
            permissions={permissions}
            selectedIds={selectedPermissionIds}
            onToggle={handleTogglePermission}
          />
        </div>
      </div>
    </div>
  );
}

export default function EditRolePage() {
  const t = useTranslations("settings.roles");
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted-foreground text-sm">{t("loadingEditor")}</div>}>
      <EditRoleForm />
    </Suspense>
  );
}
