// src/features/rbac/components/RoleCard.tsx
"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Edit, Copy, Trash, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
}

interface RoleCardProps {
  role: Role;
  permissionsCount: number;
  onEdit: (role: Role) => void;
  onClone: (role: Role) => void;
  onDelete: (role: Role) => void;
  onToggleActive: (role: Role, isActive: boolean) => void;
  isLoading?: boolean;
}

export function RoleCard({
  role,
  permissionsCount,
  onEdit,
  onClone,
  onDelete,
  onToggleActive,
  isLoading = false
}: RoleCardProps) {
  return (
    <Card className="flex flex-col h-full bg-surface border-hairline font-inter">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            {role.name}
            {role.is_system && (
              <Badge variant="secondary" className="bg-sky-500/10 text-sky-500 border-sky-500/20 py-0 px-1.5 text-[10px] uppercase font-mono">
                System
              </Badge>
            )}
          </CardTitle>
          <button
            onClick={() => onToggleActive(role, !role.is_active)}
            disabled={role.is_system || isLoading}
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase transition-colors focus:outline-none ${
              role.is_active
                ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
            } ${role.is_system ? "cursor-default opacity-85" : "cursor-pointer"}`}
          >
            {role.is_active ? (
              <>
                <Check className="h-3 w-3" /> Active
              </>
            ) : (
              <>
                <X className="h-3 w-3" /> Disabled
              </>
            )}
          </button>
        </div>
        <CardDescription className="text-mute line-clamp-2 mt-1 text-xs">
          {role.description || "No description provided."}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 py-2">
        <div className="flex items-center gap-2 text-xs text-mute font-mono">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span>{permissionsCount} explicit permissions mapped</span>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-hairline flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onClone(role)}
          disabled={isLoading}
          className="h-8 text-xs flex gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" /> Clone
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(role)}
          disabled={isLoading}
          className="h-8 text-xs flex gap-1.5"
        >
          <Edit className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(role)}
          disabled={role.is_system || isLoading}
          className="h-8 text-xs flex gap-1.5 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash className="h-3.5 w-3.5" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
export default RoleCard;
