// src/features/rbac/components/UserRoleTable.tsx
"use client";

import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, UserCog } from "lucide-react";

interface Role {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  clerk_user_id: string;
  user_roles: { roles: Role }[];
}

interface UserRoleTableProps {
  profiles: Profile[];
  availableRoles: Role[];
  onAssignRoles: (profileId: string, roleIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function UserRoleTable({
  profiles,
  availableRoles,
  onAssignRoles,
  isLoading = false
}: UserRoleTableProps) {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [checkedRoleIds, setCheckedRoleIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenAssign = (profile: Profile) => {
    setSelectedProfile(profile);
    setCheckedRoleIds(profile.user_roles.map((ur) => ur.roles.id));
    setError(null);
    setIsDialogOpen(true);
  };

  const handleToggleRole = (roleId: string) => {
    setCheckedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    if (!selectedProfile) return;
    try {
      setError(null);
      await onAssignRoles(selectedProfile.id, checkedRoleIds);
      setIsDialogOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to assign roles");
    }
  };

  return (
    <div className="space-y-4 font-inter">
      <div className="rounded-md border border-hairline bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-hairline hover:bg-transparent">
              <TableHead className="font-semibold text-ink text-xs uppercase font-mono">Full Name</TableHead>
              <TableHead className="font-semibold text-ink text-xs uppercase font-mono">Email</TableHead>
              <TableHead className="font-semibold text-ink text-xs uppercase font-mono">Mapped Roles</TableHead>
              <TableHead className="text-right font-semibold text-ink text-xs uppercase font-mono">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-mute text-xs italic">
                  No staff profiles found.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((profile) => (
                <TableRow key={profile.id} className="border-b border-hairline hover:bg-surface-elevated transition-colors">
                  <TableCell className="font-medium text-ink text-xs font-mono">
                    {profile.full_name || "Unnamed User"}
                  </TableCell>
                  <TableCell className="text-mute text-xs font-mono">{profile.email || "No email"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.user_roles.length === 0 ? (
                        <Badge variant="outline" className="border-rose-500/20 text-rose-500 bg-rose-500/5 text-[10px] uppercase font-mono">
                          No Roles
                        </Badge>
                      ) : (
                        profile.user_roles.map((ur) => (
                          <Badge key={ur.roles.id} variant="outline" className="border-hairline text-mute text-[10px] uppercase font-mono">
                            {ur.roles.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAssign(profile)}
                      disabled={isLoading}
                      className="h-8 text-xs flex gap-1.5 ml-auto border-hairline"
                    >
                      <UserCog className="h-3.5 w-3.5" /> Manage Roles
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Role Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-surface border-hairline font-inter">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Manage Staff Roles
            </DialogTitle>
            <DialogDescription className="text-mute text-xs">
              Assign one or more roles to {selectedProfile?.full_name || "this user"}. Permissions will merge automatically.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 font-mono">
              {error}
            </div>
          )}

          <div className="grid gap-3 py-2">
            {availableRoles.map((role) => {
              const isChecked = checkedRoleIds.includes(role.id);
              return (
                <div
                  key={role.id}
                  onClick={() => handleToggleRole(role.id)}
                  className="flex items-center space-x-3 rounded-md border border-hairline p-3 hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  <Checkbox
                    id={`assign-role-${role.id}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggleRole(role.id)}
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor={`assign-role-${role.id}`}
                    className="text-xs font-semibold text-ink font-mono cursor-pointer"
                  >
                    {role.name}
                  </Label>
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-4 border-t border-hairline">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading} className="h-9 text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="h-9 text-xs text-white bg-primary hover:bg-primary-hover"
            >
              Save Mappings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default UserRoleTable;
