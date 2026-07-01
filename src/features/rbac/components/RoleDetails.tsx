// src/features/rbac/components/RoleDetails.tsx
"use client";

import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PermissionBadge } from "./PermissionBadge";
import { Calendar, User, ShieldAlert } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Permission {
  id: string;
  name: string;
  is_deny: boolean;
}

interface RoleDetailsProps {
  role: {
    id: string;
    name: string;
    description: string | null;
    is_system: boolean;
    is_active: boolean;
    created_at: Date;
    permissions: Permission[];
  } | null;
  assignedUsers: Profile[];
  isOpen: boolean;
  onClose: () => void;
}

export function RoleDetails({ role, assignedUsers, isOpen, onClose }: RoleDetailsProps) {
  if (!role) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <SheetContent className="sm:max-w-md md:max-w-lg bg-surface border-hairline flex flex-col font-inter h-full">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl font-bold tracking-tight text-ink">
            {role.name}
          </SheetTitle>
          <SheetDescription className="text-mute text-xs">
            {role.description || "No description provided."}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 py-4 pr-3">
          <div className="space-y-6">
            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4 text-xs text-mute font-mono">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Created: {new Date(role.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-primary" />
                <span>Type: {role.is_system ? "System Default" : "Custom Role"}</span>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight text-ink uppercase text-primary">
                Explicit Permissions
              </h3>
              {role.permissions.length === 0 ? (
                <p className="text-xs text-mute italic">No permissions explicitly assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((p) => {
                    const action = p.name.split(".").pop() || p.name;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-1.5 rounded-md border py-1 px-2 text-xs font-mono bg-background ${
                          p.is_deny ? "border-rose-500/20 text-rose-500 bg-rose-500/5" : "border-hairline text-mute"
                        }`}
                      >
                        {p.is_deny && <ShieldAlert className="h-3 w-3 text-rose-500 shrink-0" />}
                        <span>{p.name}</span>
                        <PermissionBadge action={action} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Assigned Users */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight text-ink uppercase text-primary">
                Assigned Staff ({assignedUsers.length})
              </h3>
              {assignedUsers.length === 0 ? (
                <p className="text-xs text-mute italic">No staff members currently assigned to this role.</p>
              ) : (
                <div className="divide-y divide-hairline rounded-md border border-hairline bg-background">
                  {assignedUsers.map((user) => (
                    <div key={user.id} className="p-3 flex items-center justify-between text-xs font-mono">
                      <div>
                        <p className="font-semibold text-ink">{user.full_name || "Unnamed User"}</p>
                        <p className="text-mute text-[10px] mt-0.5">{user.email || "No email"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
export default RoleDetails;
