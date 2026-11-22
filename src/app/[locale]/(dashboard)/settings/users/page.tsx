// src/app/(dashboard)/settings/users/page.tsx
"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import { useQuery } from "@tanstack/react-query";
import { getProfilesAction } from "@/features/rbac/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

export default function UsersSettingsPage() {
  const t = useTranslations("settings.users");
  const tStatus = useTranslations("enums.status");
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["rbacProfiles"],
    queryFn: async () => {
      const res = await getProfilesAction();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" /> {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("subtitle")}
          </p>
        </div>

        <Button asChild className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/settings/user-roles" className="flex gap-1.5">
            {t("manageAssignments")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">{t("loading")}</div>
      ) : profiles.length === 0 ? (
        <div className="py-24 text-center text-sm text-muted-foreground border border-dashed border-hairline rounded-md">
          {t("empty")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile: any) => (
            <Card key={profile.id} className="bg-surface border-hairline">
              <CardHeader className="pb-3 flex flex-row justify-between items-start space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                    {profile.full_name || t("unnamedPractitioner")}
                  </CardTitle>
                  <p className="text-muted-foreground font-mono text-[11px] mt-0.5">{profile.email}</p>
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
                  {profile.status === "active"
                    ? tStatus("active")
                    : profile.status === "blocked"
                      ? tStatus("blocked")
                      : tStatus("inactive")}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.specialty && (
                  <div className="text-xs text-muted-foreground font-mono">
                    <span className="font-semibold text-foreground">{t("specialtyLabel")} </span>
                    {profile.specialty}
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase font-mono">{t("activeSecurityRoles")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.user_roles?.length === 0 ? (
                      <Badge variant="outline" className="border-rose-500/20 text-rose-500 bg-rose-500/5 text-[9px] uppercase font-mono">
                        {t("noRolesAssigned")}
                      </Badge>
                    ) : (
                      profile.user_roles?.map((ur: any) => (
                        <Badge key={ur.roles.id} variant="outline" className="border-hairline text-muted-foreground text-[9px] uppercase font-mono">
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
