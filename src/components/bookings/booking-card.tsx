"use client";

import { format } from "date-fns";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  LogIn,
  MoreHorizontal,
  Pencil,
  Stethoscope,
  Tag,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { BookingItem, BookingRoleScope } from "@/types/booking.types";
import type { AppointmentStatus } from "@/types/staff.types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";

interface BookingCardProps {
  booking: BookingItem;
  roleScope: BookingRoleScope;
  onOpen: (id: string, tab: "view" | "edit") => void;
  onStatusTransition: (id: string, status: AppointmentStatus) => void;
  onRequestCancel: (id: string) => void;
  isUpdating?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function BookingCard({
  booking,
  roleScope,
  onOpen,
  onStatusTransition,
  onRequestCancel,
  isUpdating = false,
}: BookingCardProps) {
  const t = useTranslations("pages.booking");
  const tCat = useTranslations("admin.billing.categories");
  const locale = useLocale();

  const dateObj = new Date(booking.appointmentDate);
  const isPatientView = roleScope === "patient";
  const primaryName = isPatientView
    ? booking.doctor?.fullName || t("unassignedDoctor")
    : booking.patient.fullName;
  const secondaryLabel = isPatientView
    ? booking.doctor?.specialty || t("generalPractice")
    : booking.doctor
      ? t("withDoctor", { name: booking.doctor.fullName })
      : t("unassignedDoctor");

  const { capabilities } = booking;

  return (
    <Card
      elevated
      role="button"
      tabIndex={0}
      onClick={() => onOpen(booking.id, "view")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(booking.id, "view");
        }
      }}
      className={cn(
        "group cursor-pointer py-0 transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
          {/* Time block */}
          <div className="flex min-w-[84px] shrink-0 flex-col items-center justify-center rounded-[var(--radius-button)] border border-hairline bg-canvas-soft px-2.5 py-2 text-center">
            <span className="text-sm font-bold tabular-nums text-foreground">
              {format(dateObj, "h:mm a")}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {format(dateObj, "MMM d")}
            </span>
          </div>

          <Avatar className="hidden h-10 w-10 shrink-0 sm:flex">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(primaryName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {primaryName}
              </p>
              <StatusBadge status={booking.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="h-3.5 w-3.5 text-primary/80" />
                <span className="truncate">{secondaryLabel}</span>
              </span>
              {booking.branch && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate">{booking.branch.name}</span>
                </span>
              )}
              {!isPatientView && booking.catalogItem && (
                <Badge
                  variant="secondary"
                  className="inline-flex h-5 items-center gap-1 px-1.5 text-[11px] font-medium"
                >
                  <Tag className="h-3 w-3 text-primary" />
                  <span className="max-w-[160px] truncate">
                    {locale === "ar"
                      ? booking.catalogItem.nameAr
                      : booking.catalogItem.nameEn}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    · {tCat(booking.catalogItem.category)}
                  </span>
                </Badge>
              )}
              {booking.checkedInAt && (
                <span className="inline-flex items-center gap-1 text-accent-yellow">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {t("checkedInAtTime", {
                      time: format(new Date(booking.checkedInAt), "h:mm a"),
                    })}
                  </span>
                </span>
              )}
            </div>

            {booking.notes && (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {booking.notes}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex shrink-0 items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge variant="outline" className="hidden font-mono text-[11px] md:inline-flex">
            <CalendarDays className="me-1 h-3 w-3" />
            #{booking.id.slice(0, 8).toUpperCase()}
          </Badge>

          {capabilities.canEditDetails && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isUpdating}
              onClick={() => onOpen(booking.id, "edit")}
            >
              <Pencil className="me-1.5 h-3.5 w-3.5" />
              {t("btnEdit")}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("actionsLabel")}
                disabled={isUpdating}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(booking.id, "view")}>
                <Eye className="me-2 h-4 w-4" />
                {t("actionView")}
              </DropdownMenuItem>
              {capabilities.canEditDetails && (
                <DropdownMenuItem onClick={() => onOpen(booking.id, "edit")}>
                  <Pencil className="me-2 h-4 w-4" />
                  {t("actionEdit")}
                </DropdownMenuItem>
              )}
              {capabilities.canCheckIn && (
                <DropdownMenuItem
                  onClick={() => onStatusTransition(booking.id, "checked_in")}
                >
                  <LogIn className="me-2 h-4 w-4" />
                  {t("actionCheckIn")}
                </DropdownMenuItem>
              )}
              {capabilities.canComplete && (
                <DropdownMenuItem
                  onClick={() => onStatusTransition(booking.id, "completed")}
                >
                  <CheckCircle2 className="me-2 h-4 w-4" />
                  {t("actionComplete")}
                </DropdownMenuItem>
              )}
              {capabilities.canCancel && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onRequestCancel(booking.id)}
                  >
                    <XCircle className="me-2 h-4 w-4" />
                    {t("actionCancel")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
