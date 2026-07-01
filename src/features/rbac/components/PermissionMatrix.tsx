// src/features/rbac/components/PermissionMatrix.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermissionCheckbox, PermissionState } from "./PermissionCheckbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
}

interface RolePermissionMap {
  roleId: string;
  permissionId: string;
  isDeny: boolean;
}

interface PermissionMatrixProps {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermissionMap[];
  hierarchyLinks: { parent_role_id: string; child_role_id: string }[];
  onSaveCell: (roleId: string, permissionId: string, state: "allow" | "deny" | "none") => Promise<void>;
  isLoading?: boolean;
}

export function PermissionMatrix({
  roles,
  permissions,
  rolePermissions,
  hierarchyLinks,
  onSaveCell,
  isLoading = false
}: PermissionMatrixProps) {
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, PermissionState>>>({});

  // Parse parent-child links to compute inheritance tree
  const getInheritedRoles = (roleId: string): string[] => {
    const visited = new Set<string>();
    const queue = [roleId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        const children = hierarchyLinks
          .filter((link) => link.parent_role_id === current)
          .map((link) => link.child_role_id);
        for (const child of children) {
          if (!visited.has(child)) {
            queue.push(child);
          }
        }
      }
    }
    return Array.from(visited);
  };

  // Compute the states for the matrix cells
  useEffect(() => {
    const data: Record<string, Record<string, PermissionState>> = {};

    for (const perm of permissions) {
      data[perm.id] = {};

      for (const role of roles) {
        // 1. Direct explicit check
        const direct = rolePermissions.find(
          (rp) => rp.roleId === role.id && rp.permissionId === perm.id
        );

        if (direct) {
          data[perm.id][role.id] = direct.isDeny ? "deny" : "allow";
        } else {
          // 2. Check inheritance (if any child role inherits allow, and no child denies)
          const inheritedRoles = getInheritedRoles(role.id).filter((id) => id !== role.id);
          
          let isInheritedAllow = false;
          let isInheritedDeny = false;

          for (const inheritedId of inheritedRoles) {
            const childMap = rolePermissions.find(
              (rp) => rp.roleId === inheritedId && rp.permissionId === perm.id
            );
            if (childMap) {
              if (childMap.isDeny) {
                isInheritedDeny = true;
              } else {
                isInheritedAllow = true;
              }
            }
          }

          if (isInheritedDeny) {
            data[perm.id][role.id] = "deny"; // Deny propagates in hierarchy
          } else if (isInheritedAllow) {
            data[perm.id][role.id] = "inherited";
          } else {
            data[perm.id][role.id] = "none";
          }
        }
      }
    }

    setMatrixData(data);
  }, [roles, permissions, rolePermissions, hierarchyLinks]);

  const handleCellChange = async (roleId: string, permissionId: string, newState: "allow" | "deny" | "none") => {
    // Optimistic Update
    setMatrixData((prev) => ({
      ...prev,
      [permissionId]: {
        ...prev[permissionId],
        [roleId]: newState as PermissionState
      }
    }));

    try {
      await onSaveCell(roleId, permissionId, newState);
    } catch {
      // Revert is handled automatically when props re-render
    }
  };

  return (
    <div className="space-y-4 font-inter">
      {/* Legend Info */}
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-hairline bg-surface p-3 text-xs text-mute">
        <div className="flex items-center gap-1.5 font-semibold">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span>Legend:</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <div className="h-4 w-4 rounded border border-emerald-500 bg-emerald-500" />
          <span>Explicit Allow</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <div className="h-4 w-4 rounded border border-rose-500 bg-rose-500" />
          <span>Explicit Deny</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <div className="h-4 w-4 rounded border border-sky-500/30 bg-sky-500/10" />
          <span>Inherited (Hierarchical)</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <div className="h-4 w-4 rounded border border-hairline bg-background" />
          <span>No Permission</span>
        </div>
      </div>

      {/* Spreadsheet grid */}
      <div className="rounded-md border border-hairline bg-surface overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className="border-b border-hairline hover:bg-transparent">
              <TableHead className="w-[300px] font-semibold text-ink text-xs uppercase font-mono">Module Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id} className="text-center font-semibold text-ink text-xs uppercase font-mono">
                  {role.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={roles.length + 1} className="h-24 text-center text-mute text-xs italic">
                  No permissions loaded.
                </TableCell>
              </TableRow>
            ) : (
              permissions.map((perm) => (
                <TableRow
                  key={perm.id}
                  className="border-b border-hairline hover:bg-surface-elevated transition-colors"
                >
                  <TableCell className="font-mono text-xs text-ink py-2.5">
                    <div>
                      <p className="font-medium">{perm.name}</p>
                      {perm.description && (
                        <p className="text-[10px] text-mute/80 mt-0.5 line-clamp-1">
                          {perm.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  {roles.map((role) => {
                    const cellState = matrixData[perm.id]?.[role.id] || "none";
                    return (
                      <TableCell key={role.id} className="text-center py-2.5">
                        <div className="flex justify-center">
                          <PermissionCheckbox
                            state={cellState}
                            onChange={(state) => handleCellChange(role.id, perm.id, state)}
                            disabled={isLoading}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
export default PermissionMatrix;
