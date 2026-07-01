// src/features/rbac/components/RoleSelector.tsx
"use client";

import React from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Role {
  id: string;
  name: string;
}

interface RoleSelectorProps {
  roles: Role[];
  selectedRoleId: string | null;
  onSelect: (roleId: string) => void;
  disabled?: boolean;
  label?: string;
}

export function RoleSelector({
  roles,
  selectedRoleId,
  onSelect,
  disabled = false,
  label = "Select Role"
}: RoleSelectorProps) {
  return (
    <div className="space-y-1.5 font-inter">
      {label && <Label className="text-xs font-semibold text-ink uppercase">{label}</Label>}
      <Select value={selectedRoleId || ""} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger className="h-9 border-hairline font-mono text-xs">
          <SelectValue placeholder="Choose a role..." />
        </SelectTrigger>
        <SelectContent className="bg-surface border-hairline">
          {roles.map((role) => (
            <SelectItem key={role.id} value={role.id} className="font-mono text-xs">
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export default RoleSelector;
