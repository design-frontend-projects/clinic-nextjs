"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  Calendar,
  Mail,
  MapPin,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UserProfileView } from "@/types/profile.types";

interface ProfileSummaryCardProps {
  profile: UserProfileView;
}

const KNOWN_ROLES = new Set([
  "owner",
  "admin",
  "super_admin",
  "app_owner",
  "doctor",
  "staff",
  "pharmacist",
  "receptionist",
  "patient",
]);

const KNOWN_STATUSES = new Set(["active", "inactive", "blocked"]);

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function ProfileSummaryCard({ profile }: ProfileSummaryCardProps) {
  const t = useTranslations("pages.profile");
  const locale = useLocale();

  const initials = useMemo(
    () => getInitials(profile.full_name, profile.email),
    [profile.full_name, profile.email],
  );

  const memberSince = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(profile.created_at));
    } catch {
      return profile.created_at.slice(0, 10);
    }
  }, [locale, profile.created_at]);

  const roleLabel = KNOWN_ROLES.has(profile.role)
    ? t(`roles.${profile.role}` as "roles.staff")
    : profile.role;

  const statusLabel = KNOWN_STATUSES.has(profile.status)
    ? t(`statuses.${profile.status}` as "statuses.active")
    : profile.status;

  const statusVariant =
    profile.status === "active"
      ? "info"
      : profile.status === "blocked"
        ? "destructive"
        : "secondary";

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 border border-hairline">
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate text-xl">
              {profile.full_name || profile.email}
            </CardTitle>
            <CardDescription className="truncate">
              {profile.email}
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="primary" className="gap-1">
                <UserCheck className="h-3 w-3" />
                {roleLabel}
              </Badge>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="space-y-4 pt-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("summaryTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("summaryDescription")}
          </p>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span>{t("lblEmail")}</span>
            </dt>
            <dd className="flex flex-col items-end gap-1 text-end">
              <span className="font-medium text-foreground break-all">
                {profile.email}
              </span>
              <Badge variant="outline" className="text-[11px]">
                <ShieldCheck className="h-3 w-3 text-primary" />
                {t("verifiedEmailBadge")}
              </Badge>
            </dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <span>{t("lblClinic")}</span>
            </dt>
            <dd className="font-medium text-foreground text-end">
              {profile.clinic?.name ?? t("noClinic")}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{t("lblBranches")}</span>
            </dt>
            <dd className="flex flex-wrap justify-end gap-1.5 text-end">
              {profile.branches.length > 0 ? (
                profile.branches.map((branch) => (
                  <Badge
                    key={`${branch.id}-${branch.clinic_name ?? ""}`}
                    variant={branch.is_primary ? "default" : "outline"}
                  >
                    {branch.name}
                    {branch.is_primary && profile.branches.length > 1
                      ? ` (${t("primaryBranch")})`
                      : ""}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{t("noBranches")}</span>
              )}
            </dd>
          </div>

          {profile.specialty && (
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Stethoscope className="h-4 w-4 shrink-0" />
                <span>{t("lblSpecialty")}</span>
              </dt>
              <dd className="font-medium text-foreground text-end">
                {profile.specialty}
              </dd>
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{t("lblMemberSince")}</span>
            </dt>
            <dd className="font-medium text-foreground text-end">
              {memberSince}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
