// src/features/rbac/components/RoleEditor.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PermissionTree } from "./PermissionTree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions?: { id: string }[];
}

interface RoleEditorProps {
  role: Role | null; // null for Create Mode, Role object for Edit Mode
  availablePermissions: Permission[];
  availableRoles: { id: string; name: string }[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    permissionIds: string[];
    parentRoleId: string | null;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function RoleEditor({
  role,
  availablePermissions,
  availableRoles,
  isOpen,
  onClose,
  onSave,
  isLoading = false
}: RoleEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentRoleId, setParentRoleId] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sync state on mode change
  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      setSelectedPermissionIds(role.permissions?.map((p) => p.id) || []);
      setParentRoleId(null); // Will load from hierarchy action if requested, default null
    } else {
      setName("");
      setDescription("");
      setSelectedPermissionIds([]);
      setParentRoleId(null);
    }
    setError(null);
  }, [role, isOpen]);

  const handleTogglePermission = (id: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required");
      return;
    }

    try {
      setError(null);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        permissionIds: selectedPermissionIds,
        parentRoleId: parentRoleId === "none" ? null : parentRoleId
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save role");
    }
  };

  // Filter out the current role from available parent roles to prevent circular inheritance
  const filteredRoles = availableRoles.filter((r) => !role || r.id !== role.id);

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl bg-surface border-hairline flex flex-col font-inter max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {role ? `Edit Role: ${role.name}` : "Create New Role"}
          </DialogTitle>
          <DialogDescription className="text-mute text-xs">
            {role ? "Modify permissions and settings for this role." : "Create a new custom role with default permissions and optional hierarchy links."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 font-mono">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="role_name" className="text-xs font-semibold text-ink uppercase">
                Role Name
              </Label>
              <Input
                id="role_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Senior Nurse"
                disabled={role?.is_system || isLoading}
                className="h-9 border-hairline font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="parent_role" className="text-xs font-semibold text-ink uppercase">
                Inherits From (Hierarchy Parent)
              </Label>
              <Select
                value={parentRoleId || "none"}
                onValueChange={(val) => setParentRoleId(val === "none" ? null : val)}
                disabled={isLoading}
              >
                <SelectTrigger id="parent_role" className="h-9 border-hairline font-mono text-sm">
                  <SelectValue placeholder="Select parent role" />
                </SelectTrigger>
                <SelectContent className="bg-surface border-hairline">
                  <SelectItem value="none" className="font-mono text-xs">None (Base Role)</SelectItem>
                  {filteredRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="font-mono text-xs">
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role_desc" className="text-xs font-semibold text-ink uppercase">
              Description
            </Label>
            <Textarea
              id="role_desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a brief description of the role's responsibilities"
              disabled={isLoading}
              rows={2}
              className="border-hairline text-sm resize-none"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 space-y-1.5">
            <Label className="text-xs font-semibold text-ink uppercase">
              Assign Permissions
            </Label>
            <ScrollArea className="flex-1 border border-hairline rounded-md bg-background p-1 max-h-[30vh]">
              <PermissionTree
                permissions={availablePermissions}
                selectedIds={selectedPermissionIds}
                onToggle={handleTogglePermission}
              />
            </ScrollArea>
          </div>

          <DialogFooter className="pt-4 border-t border-hairline">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {role ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default RoleEditor;
