"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInMinutes, format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  UserCheck,
  Users,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getBookingContext } from "@/app/actions/booking";
import { getStaffDashboardStats, getStaffQueue } from "@/app/actions/staff";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { BookingCreateDialog } from "@/components/bookings/booking-create-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Input } from "@/components/ui/input";
import { LiveBadge } from "@/components/ui/live-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePermission } from "@/features/rbac/hooks/useAuthorization";
import { useStaffAppointmentActions } from "@/hooks/use-staff-appointment-actions";
import { useAppointmentsRealtime } from "@/lib/appointments/use-appointments-realtime";
import { cn } from "@/lib/utils";
import type { StaffQueueItem } from "@/types/staff.types";

type QueueTab = "all" | "scheduled" | "checked_in";

export default function CheckinQueuePage() {
  const t = useTranslations("pages.staff");
  const canManageQueue = usePermission("appointment.create");
  const canCancel = usePermission("appointment.cancel");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<QueueTab>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [pendingCancel, setPendingCancel] = useState<StaffQueueItem | null>(
    null,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live 30s client-side wait-time tick without network refetching
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut: "/" focuses the search bar, "Escape" clears it
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "/" && !isTypingTarget) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const { data: bookingContext } = useQuery({
    queryKey: ["booking-context"],
    queryFn: () => getBookingContext(),
  });

  useAppointmentsRealtime(tenant?.clinicId, {
    onCheckIn: () => toast.success(t("checkedInLive")),
  });

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["staff-queue"],
    queryFn: () => getStaffQueue(),
    refetchInterval: 60_000,
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: () => getStaffDashboardStats(),
  });

  const { pendingIds, checkIn, complete, markNoShow, undoCheckIn, cancel } =
    useStaffAppointmentActions();

  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of queue) {
      if (item.doctorId) {
        map.set(item.doctorId, item.doctorName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [queue]);

  const scheduledCount = useMemo(
    () => queue.filter((q) => q.status === "scheduled").length,
    [queue],
  );
  const checkedInCount = useMemo(
    () => queue.filter((q) => q.status === "checked_in").length,
    [queue],
  );
  const longestWaitMins = useMemo(() => {
    let max = 0;
    const now = new Date(nowMs);
    for (const item of queue) {
      if (item.status === "checked_in" && item.checkedInAt) {
        const mins = Math.max(
          differenceInMinutes(now, new Date(item.checkedInAt)),
          0,
        );
        if (mins > max) max = mins;
      }
    }
    return max;
  }, [queue, nowMs]);

  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = queue.filter((item) => {
      if (statusTab !== "all" && item.status !== statusTab) return false;
      if (doctorFilter !== "all" && item.doctorId !== doctorFilter) {
        return false;
      }
      if (!q) return true;
      const code = item.id.slice(0, 8).toLowerCase();
      return (
        item.patientName.toLowerCase().includes(q) ||
        (item.patientPhone?.toLowerCase().includes(q) ?? false) ||
        item.doctorName.toLowerCase().includes(q) ||
        code.includes(q)
      );
    });

    if (statusTab === "checked_in") {
      return [...list].sort((a, b) => {
        const aTime = a.checkedInAt ? new Date(a.checkedInAt).getTime() : 0;
        const bTime = b.checkedInAt ? new Date(b.checkedInAt).getTime() : 0;
        return aTime - bTime; // longest waiting first
      });
    }
    return list;
  }, [queue, searchQuery, statusTab, doctorFilter]);

  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {t("checkInTitle")}
            </h1>
            <LiveBadge />
          </div>
          <p className="text-muted-foreground">{t("checkInSubtitle")}</p>
        </div>
        {canManageQueue && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("newAppointment")}
          </Button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title={t("awaitingCheckIn")}
          value={scheduledCount}
          icon={CalendarClock}
        />
        <StatCard
          title={t("inWaitingRoom")}
          value={checkedInCount}
          icon={Users}
        />
        <StatCard
          title={t("longestWait")}
          value={`${longestWaitMins} ${t("minsShort")}`}
          icon={Clock}
        />
        <StatCard
          title={t("completedTodayLabel")}
          value={dashboardStats?.completedToday ?? 0}
          icon={UserCheck}
        />
      </div>

      {/* Speed Toolbar */}
      <Card className="py-0">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("checkinSearchPlaceholder")}
                className="ps-9 pe-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label={t("tabAll")}
                  onClick={() => setSearchQuery("")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {doctorOptions.length > 0 && (
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={t("allDoctorsFilter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allDoctorsFilter")}</SelectItem>
                  {doctorOptions.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="inline-flex flex-wrap rounded-[var(--radius-button)] border border-hairline bg-canvas-soft p-1">
            {(
              [
                { key: "all", label: t("tabAll"), count: queue.length },
                {
                  key: "scheduled",
                  label: t("tabScheduled"),
                  count: scheduledCount,
                },
                {
                  key: "checked_in",
                  label: t("tabCheckedIn"),
                  count: checkedInCount,
                },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.key}
                type="button"
                size="sm"
                variant={statusTab === tab.key ? "default" : "ghost"}
                onClick={() => setStatusTab(tab.key)}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums",
                    statusTab === tab.key
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Queue List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-20 w-full rounded-[var(--radius-card)]"
            />
          ))}
        </div>
      ) : filteredQueue.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center gap-2 text-center">
            <Users className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              {searchQuery || statusTab !== "all" || doctorFilter !== "all"
                ? t("emptyQueueFiltered")
                : t("emptyQueueAll")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredQueue.map((item) => {
            const isBusy = pendingIds.has(item.id);
            const isCheckedIn = item.status === "checked_in";
            const waitMins =
              isCheckedIn && item.checkedInAt
                ? Math.max(
                    differenceInMinutes(nowDate, new Date(item.checkedInAt)),
                    0,
                  )
                : null;
            const isOverdue = waitMins !== null && waitMins >= 30;
            const isWarningWait =
              waitMins !== null && waitMins >= 15 && waitMins < 30;

            return (
              <Card
                key={item.id}
                className={cn(
                  "py-0 transition-colors",
                  isCheckedIn &&
                    "border-s-4 border-s-amber-500 bg-amber-500/[0.03]",
                  isOverdue && "border-s-destructive bg-destructive/[0.03]",
                )}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    {/* Time slot badge */}
                    <div className="flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-[var(--radius-button)] border border-hairline bg-canvas-soft px-2.5 py-2 text-center">
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {format(new Date(item.appointmentDate), "h:mm a")}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{item.id.slice(0, 6).toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.patientName}
                        </p>
                        <StatusBadge status={item.status} />
                        {waitMins !== null && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 text-[11px] tabular-nums",
                              isOverdue
                                ? "border-destructive/40 bg-destructive/10 text-destructive"
                                : isWarningWait
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {isOverdue ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            <span>
                              {waitMins} {t("minsShort")}
                            </span>
                            {isOverdue && (
                              <span className="font-semibold">
                                · {t("overdueBadge")}
                              </span>
                            )}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Stethoscope className="h-3.5 w-3.5 text-primary/80" />
                          <span>{item.doctorName}</span>
                          {item.doctorSpecialty && (
                            <span className="text-muted-foreground/75">
                              ({item.doctorSpecialty})
                            </span>
                          )}
                        </span>
                        {item.patientPhone && (
                          <span
                            dir="ltr"
                            className="inline-flex items-center gap-1 tabular-nums"
                          >
                            <Phone className="h-3 w-3" />
                            {item.patientPhone}
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {canManageQueue && (
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      {item.status === "scheduled" ? (
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => checkIn(item.id, item.status)}
                        >
                          {isBusy ? (
                            <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <LogIn className="me-1.5 h-4 w-4" />
                          )}
                          {t("checkIn")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isBusy}
                          onClick={() => complete(item.id, item.status)}
                        >
                          {isBusy ? (
                            <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="me-1.5 h-4 w-4" />
                          )}
                          {t("markComplete")}
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={isBusy}
                            aria-label={t("actionsMenuLabel")}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.status === "checked_in" ? (
                            <DropdownMenuItem
                              onClick={() => undoCheckIn(item.id, item.status)}
                            >
                              <RotateCcw className="me-2 h-4 w-4" />
                              {t("undoCheckIn")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => markNoShow(item.id, item.status)}
                            >
                              <UserX className="me-2 h-4 w-4" />
                              {t("markNoShow")}
                            </DropdownMenuItem>
                          )}
                          {canCancel && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setPendingCancel(item)}
                              >
                                <XCircle className="me-2 h-4 w-4" />
                                {t("cancelAppointment")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {bookingContext && (
        <BookingCreateDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          context={bookingContext}
        />
      )}

      <AlertDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelConfirmDesc", {
                patient: pendingCancel?.patientName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepAppointment")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!pendingCancel) return;
                cancel(pendingCancel.id, pendingCancel.status);
                setPendingCancel(null);
              }}
            >
              {t("confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
