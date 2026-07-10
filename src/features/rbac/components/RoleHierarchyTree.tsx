// src/features/rbac/components/RoleHierarchyTree.tsx
"use client";

import React, { useState } from "react";
import { GitMerge, ArrowDown, Plus, Trash, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface RoleLink {
  id: string;
  parent_role: { id: string; name: string };
  child_role: { id: string; name: string };
}

interface RoleHierarchyTreeProps {
  links: RoleLink[];
  availableRoles: { id: string; name: string }[];
  onAddLink: (parentRoleId: string, childRoleId: string) => Promise<void>;
  onRemoveLink: (parentRoleId: string, childRoleId: string) => Promise<void>;
  isLoading?: boolean;
}

export function RoleHierarchyTree({
  links,
  availableRoles,
  onAddLink,
  onRemoveLink,
  isLoading = false
}: RoleHierarchyTreeProps) {
  const [parentSelect, setParentSelect] = useState<string | null>(null);
  const [childSelect, setChildSelect] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!parentSelect || !childSelect) return;
    if (parentSelect === childSelect) {
      setError("Role cannot inherit from itself");
      return;
    }
    
    try {
      setError(null);
      await onAddLink(parentSelect, childSelect);
      setParentSelect(null);
      setChildSelect(null);
    } catch (err: any) {
      setError(err.message || "Failed to link roles");
    }
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 space-y-4 font-inter">
      <div className="flex items-center gap-2">
        <GitMerge className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight text-ink uppercase">Role Inheritance Mappings</h3>
      </div>

      <p className="text-xs text-mute leading-relaxed">
        Establish relations where a <strong>Parent Role</strong> automatically inherits all permissions mapped to the <strong>Child Role</strong>.
      </p>

      {error && (
        <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 font-mono">
          {error}
        </div>
      )}

      {/* Link Maker */}
      <div className="flex flex-col sm:flex-row gap-3 items-end bg-background border border-hairline rounded-md p-3">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-mute uppercase font-mono">Parent Role (Inherits)</label>
          <Select value={parentSelect || ""} onValueChange={setParentSelect}>
            <SelectTrigger className="h-9 border-hairline font-mono text-xs">
              <SelectValue placeholder="Select Parent" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-hairline">
              {availableRoles.map((r) => (
                <SelectItem key={r.id} value={r.id} className="font-mono text-xs">{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-center items-center h-9 pb-2 text-mute">
          <ArrowDown className="h-4 w-4 rotate-90 sm:rotate-0" />
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-mute uppercase font-mono">Child Role (Inherited)</label>
          <Select value={childSelect || ""} onValueChange={setChildSelect}>
            <SelectTrigger className="h-9 border-hairline font-mono text-xs">
              <SelectValue placeholder="Select Child" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-hairline">
              {availableRoles.map((r) => (
                <SelectItem key={r.id} value={r.id} className="font-mono text-xs">{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleAdd}
          disabled={!parentSelect || !childSelect || isLoading}
          className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> Link Roles
        </Button>
      </div>

      {/* active links list */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-bold text-mute uppercase tracking-wide">Active Inheritance Rules</h4>
        {links.length === 0 ? (
          <p className="text-xs text-mute italic py-3 text-center border border-dashed border-hairline rounded-md">No inheritance mappings defined.</p>
        ) : (
          <div className="grid gap-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-2.5 rounded-md border border-hairline bg-background text-xs"
              >
                <div className="flex items-center gap-2 font-mono">
                  <Badge variant="outline" className="border-indigo-500/20 text-indigo-500 bg-indigo-500/5">{link.parent_role.name}</Badge>
                  <span className="text-mute">inherits all permissions of</span>
                  <Badge variant="outline" className="border-sky-500/20 text-sky-500 bg-sky-500/5">{link.child_role.name}</Badge>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveLink(link.parent_role.id, link.child_role.id)}
                  disabled={isLoading}
                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                >
                  <Link2Off className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default RoleHierarchyTree;
