// src/app/(dashboard)/settings/roles/create/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PermissionTree } from "@/features/rbac/components/PermissionTree";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createRoleAction, getPermissionsAction, getRolesAction } from "@/features/rbac/actions";
import { ArrowLeft, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function CreateRolePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentRoleId, setParentRoleId] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch permissions & roles for parent assignment
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

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await createRoleAction(payload);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      toast.success("Role created successfully");
      router.push("/settings/roles");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create role");
      toast.error(err.message || "Failed to create role");
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
      setError("Role name is required");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      permissionIds: selectedPermissionIds,
      parentRoleId: parentRoleId === "none" ? null : parentRoleId
    });
  };

  return (
    <div className="space-y-6 font-inter max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/settings/roles")} className="h-9 w-9 border-hairline">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Create Custom Role</h1>
            <p className="text-mute text-xs mt-0.5">Initialize a custom role with permissions and hierarchy links.</p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="h-9 text-xs text-white bg-primary hover:bg-primary-hover flex gap-1.5"
        >
          <Save className="h-4 w-4" /> Save Role
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 font-mono flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Col - metadata */}
        <div className="space-y-4 md:col-span-1">
          <Card className="bg-surface border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight text-ink uppercase">Role Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="role_name" className="text-xs font-semibold text-ink uppercase">Role Name</Label>
                <Input
                  id="role_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pharmacy Assistant"
                  className="h-9 border-hairline text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="parent_role" className="text-xs font-semibold text-ink uppercase">Inherits From (Parent)</Label>
                <Select
                  value={parentRoleId || "none"}
                  onValueChange={(val) => setParentRoleId(val === "none" ? null : val)}
                >
                  <SelectTrigger id="parent_role" className="h-9 border-hairline text-sm">
                    <SelectValue placeholder="Select Parent" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-hairline">
                    <SelectItem value="none" className="font-mono text-xs">None (Base Role)</SelectItem>
                    {roles.map((r: any) => (
                      <SelectItem key={r.id} value={r.id} className="font-mono text-xs">{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role_desc" className="text-xs font-semibold text-ink uppercase">Description</Label>
                <Textarea
                  id="role_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize access privileges for this role"
                  rows={4}
                  className="border-hairline text-sm resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col - permissions */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-ink uppercase">Map Role Permissions</h3>
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
