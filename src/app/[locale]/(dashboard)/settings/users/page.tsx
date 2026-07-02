// src/app/(dashboard)/settings/users/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getProfilesAction } from "@/features/rbac/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, ShieldAlert, ArrowRight } from "lucide-react";

export default function UsersSettingsPage() {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["rbacProfiles"],
    queryFn: async () => {
      const res = await getProfilesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  return (
    <div className="space-y-6 font-inter max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" /> Staff Profiles
          </h1>
          <p className="text-mute text-sm mt-1">
            Browse registered medical practitioners, staff members, and assign security roles.
          </p>
        </div>

        <Button asChild className="h-9 text-xs text-white bg-primary hover:bg-primary-hover">
          <Link href="/settings/user-roles" className="flex gap-1.5">
            Manage Assignments <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-sm text-mute">Loading staff profiles...</div>
      ) : profiles.length === 0 ? (
        <div className="py-24 text-center text-sm text-mute border border-dashed border-hairline rounded-md">
          No profiles found associated with this clinic.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile: any) => (
            <Card key={profile.id} className="bg-surface border-hairline">
              <CardHeader className="pb-3 flex flex-row justify-between items-start space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold text-ink flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                    {profile.full_name || "Unnamed Practitioner"}
                  </CardTitle>
                  <p className="text-mute font-mono text-[11px] mt-0.5">{profile.email}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono uppercase text-[9px]",
                    profile.status === "active"
                      ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/5"
                      : "border-rose-500/20 text-rose-500 bg-rose-500/5"
                  )}
                >
                  {profile.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.specialty && (
                  <div className="text-xs text-mute font-mono">
                    <span className="font-semibold text-ink">Specialty: </span>
                    {profile.specialty}
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-mute uppercase font-mono">Active Security Roles</label>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.user_roles?.length === 0 ? (
                      <Badge variant="outline" className="border-rose-500/20 text-rose-500 bg-rose-500/5 text-[9px] uppercase font-mono">
                        No Roles Assigned
                      </Badge>
                    ) : (
                      profile.user_roles?.map((ur: any) => (
                        <Badge key={ur.roles.id} variant="outline" className="border-hairline text-mute text-[9px] uppercase font-mono">
                          {ur.roles.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple helper function inside file to support conditional class name resolution if `cn` is missing
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
