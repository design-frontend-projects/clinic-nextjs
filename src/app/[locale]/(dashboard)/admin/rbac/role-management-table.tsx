"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { createRole, updateRole, deleteRole } from "@/app/actions/rbac";
import { toast } from "sonner";
import { Edit2, Plus, Trash2 } from "lucide-react";

type Role = {
  id: string;
  name: string;
  role_permissions: {
    permissions: {
      id: string;
      name: string;
    };
  }[];
};

type Permission = {
  id: string;
  name: string;
};

export default function RoleManagementTable({
  initialRoles,
  allPermissions,
}: {
  initialRoles: Role[];
  allPermissions: Permission[];
}) {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setName(role.name);
      setSelectedPermissions(
        new Set(role.role_permissions.map((rp) => rp.permissions.id)),
      );
    } else {
      setEditingRole(null);
      setName("");
      setSelectedPermissions(new Set());
    }
    setIsDialogOpen(true);
  };

  const togglePermission = (id: string) => {
    const next = new Set(selectedPermissions);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPermissions(next);
  };

  const handleSave = async () => {
    setIsLoading(true);
    const permissionIds = Array.from(selectedPermissions);
    try {
      if (editingRole) {
        const res = await updateRole(editingRole.id, name, permissionIds);
        if (res.error) throw new Error(res.error);
        toast.success("Role updated successfully");
      } else {
        const res = await createRole(name, permissionIds);
        if (res.error) throw new Error(res.error);
        toast.success("Role created successfully");
      }
      setIsDialogOpen(false);
      // Ideally we would trigger a router.refresh() here via a parent component or use action directly
      window.location.reload();
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to save role");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      const res = await deleteRole(id);
      if (res.error) throw new Error(res.error);
      toast.success("Role deleted");
      setRoles(roles.filter((r) => r.id !== id));
    } catch (error: unknown) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Add Role
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingRole ? "Edit Role" : "Create Role"}
              </DialogTitle>
              <DialogDescription>
                Define a role and its permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Receptionist"
                />
              </div>
              <div className="grid gap-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 h-48 overflow-y-auto pr-2">
                  {allPermissions.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.id}
                        checked={selectedPermissions.has(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                      />
                      <label
                        htmlFor={perm.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {perm.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!name || isLoading} onClick={handleSave}>
                Save Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {role.role_permissions.map((rp) => (
                      <Badge
                        key={rp.permissions.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {rp.permissions.name}
                      </Badge>
                    ))}
                    {role.role_permissions.length === 0 && (
                      <span className="text-muted-foreground text-xs italic">
                        No permissions
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(role)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(role.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground h-24"
                >
                  No custom roles defined.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
