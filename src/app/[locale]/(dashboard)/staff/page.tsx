"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInMinutes, format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Loader2,
  LogIn,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Users,
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getBookingContext } from "@/app/actions/booking";
import {
  getStaffAppointments,
  getStaffDashboardStats,
} from "@/app/actions/staff";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import {
  AppointmentDateFilter,
  DEFAULT_APPT_FILTER,
  type ApptDateFilter,
} from "@/components/appointments/appointment-date-filter";
import { BookingCreateDialog } from "@/components/bookings/booking-create-dialog";
import { BookingDetailSheet } from "@/components/bookings/booking-detail-sheet";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiveBadge } from "@/components/ui/live-badge";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePermission } from "@/features/rbac/hooks/useAuthorization";
import { useStaffAppointmentActions } from "@/hooks/use-staff-appointment-actions";
import { useAppointmentsRealtime } from "@/lib/appointments/use-appointments-realtime";
import { cn } from "@/lib/utils";
import type {
  AppointmentStatus,
  StaffDashboardStats,
} from "@/types/staff.types";

const defaultStats: StaffDashboardStats = {
  todaysAppointments: 0,
  completedToday: 0,
  remainingToday: 0,
  checkedInQueue: 0,
  newPatientsToday: 0,
  paymentsCollectedToday: 0,
  queue: [],
  throughput: [],
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "var(--color-accent-blue)",
  checked_in: "var(--color-accent-yellow)",
  completed: "var(--color-accent-green)",
  cancelled: "var(--color-accent-red)",
  no_show: "var(--color-muted-foreground)",
};

const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  scheduled: "statusScheduled",
  checked_in: "statusCheckedIn",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  no_show: "statusNoShow",
};

interface PendingCancelTarget {
  id: string;
  patientName: string;
  status: AppointmentStatus;
}

export default function StaffDashboard() {
  const t = useTranslations("pages.staff");
  const canManageQueue = usePermission("appointment.create");
  const canCancel = usePermission("appointment.cancel");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sheetState, setSheetState] = useState<{
    id: string | null;
    tab: "view" | "edit";
    open: boolean;
  }>({ id: null, tab: "view", open: false });
  const [apptFilter, setApptFilter] =
    useState<ApptDateFilter>(DEFAULT_APPT_FILTER);
  const [pendingCancel, setPendingCancel] =
    useState<PendingCancelTarget | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { data: stats = defaultStats } = useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: () => getStaffDashboardStats(),
  });

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

  const { data: appointments = [] } = useQuery({
    queryKey: ["staff-appointments", apptFilter],
    queryFn: () =>
      getStaffAppointments({ range: apptFilter.mode, date: apptFilter.date }),
  });

  const { pendingIds, checkIn, complete, markNoShow, undoCheckIn, cancel } =
    useStaffAppointmentActions();

  const checkedInCount = stats.queue.filter(
    (item) => item.status === "checked_in",
  ).length;

  const chartConfig: ChartConfig = { count: { label: t("appointments") } };
  const chartData = stats.throughput.map((point) => ({
    label: t(STATUS_LABEL_KEY[point.status]),
    count: point.count,
    fill: STATUS_COLORS[point.status],
  }));
  const hasThroughput = stats.throughput.some((point) => point.count > 0);
  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);

  const renderRowActions = (
    id: string,
    patientName: string,
    status: AppointmentStatus,
  ) => {
    if (!canManageQueue || (status !== "scheduled" && status !== "checked_in")) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!bookingContext}
          onClick={() => setSheetState({ id, tab: "view", open: true })}
        >
          <Eye className="me-1.5 h-3.5 w-3.5" />
          {t("viewDetails")}
        </Button>
      );
    }
    const isBusy = pendingIds.has(id);

    return (
      <div className="flex items-center gap-1.5">
        {status === "scheduled" ? (
          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={() => checkIn(id, status)}
          >
            {isBusy ? (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogIn className="me-1.5 h-3.5 w-3.5" />
            )}
            {t("checkIn")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isBusy}
            onClick={() => complete(id, status)}
          >
            {isBusy ? (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
            )}
            {t("markComplete")}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy || !bookingContext}
          onClick={() => setSheetState({ id, tab: "edit", open: true })}
        >
          <Pencil className="me-1.5 h-3.5 w-3.5" />
          {t("editAppointment")}
        </Button>

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
            <DropdownMenuItem
              disabled={!bookingContext}
              onClick={() => setSheetState({ id, tab: "edit", open: true })}
            >
              <Pencil className="me-2 h-4 w-4" />
              {t("editAppointment")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!bookingContext}
              onClick={() => setSheetState({ id, tab: "view", open: true })}
            >
              <Eye className="me-2 h-4 w-4" />
              {t("viewDetails")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {status === "checked_in" ? (
              <DropdownMenuItem onClick={() => undoCheckIn(id, status)}>
                <RotateCcw className="me-2 h-4 w-4" />
                {t("undoCheckIn")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => markNoShow(id, status)}>
                <UserX className="me-2 h-4 w-4" />
                {t("markNoShow")}
              </DropdownMenuItem>
            )}
            {canCancel && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setPendingCancel({ id, patientName, status })}
                >
                  <XCircle className="me-2 h-4 w-4" />
                  {t("cancelAppointment")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManageQueue && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("newAppointment")}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("todaysAppointments")}
          value={stats.todaysAppointments}
          icon={CalendarDays}
          description={`${stats.completedToday} ${t("completed")}, ${stats.remainingToday} ${t("remaining")}`}
        />
        <StatCard
          title={t("checkedInQueue")}
          value={stats.checkedInQueue}
          icon={ClipboardList}
          description={t("waitingForDoctors")}
        />
        <StatCard
          title={t("newPatients")}
          value={stats.newPatientsToday}
          icon={Users}
          description={t("registeredToday")}
        />
        <StatCard
          title={t("paymentsCollected")}
          value={`$${stats.paymentsCollectedToday.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`}
          icon={Wallet}
          description={t("collectedToday")}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t("currentQueue")}</CardTitle>
              <div className="flex items-center gap-2">
                {checkedInCount > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {t("checkedInPatients", { count: checkedInCount })}
                  </span>
                )}
                <LiveBadge />
              </div>
            </div>
            <CardDescription>{t("patientsWaiting")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.queue.length === 0 ? (
              <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  {t("queueEmpty")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.queue.map((item) => {
                  const waitMins =
                    item.status === "checked_in" && item.checkedInAt
                      ? Math.max(
                          differenceInMinutes(
                            nowDate,
                            new Date(item.checkedInAt),
                          ),
                          0,
                        )
                      : null;
                  const isCheckedIn = item.status === "checked_in";
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
                        isCheckedIn &&
                          "border-s-4 border-s-amber-500 bg-amber-500/5",
                      )}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.patientName}</p>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            {item.doctorName} •{" "}
                            {format(new Date(item.appointmentDate), "h:mm a")}
                          </span>
                          {item.patientPhone && (
                            <span
                              dir="ltr"
                              className="inline-flex items-center gap-1 text-xs tabular-nums"
                            >
                              <Phone className="h-3 w-3" />
                              {item.patientPhone}
                            </span>
                          )}
                          {waitMins !== null && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                              <Clock className="h-3 w-3" />
                              {t("waiting")}: {waitMins} {t("minsShort")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-2">
                        {renderRowActions(
                          item.id,
                          item.patientName,
                          item.status,
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quickInsights")}</CardTitle>
            <CardDescription>
              {format(new Date(), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasThroughput ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={4}>
                    {chartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="mt-4 flex h-[200px] items-center justify-center border-t border-dashed">
                <p className="text-sm text-muted-foreground">
                  {t("noThroughput")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{t("appointmentsPanel")}</CardTitle>
              <CardDescription>
                {t("appointmentsPanelSubtitle")}
              </CardDescription>
            </div>
            <LiveBadge />
          </div>
          <AppointmentDateFilter
            value={apptFilter}
            onChange={setApptFilter}
            className="pt-2"
          />
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                {t("noAppointments")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const waitMins =
                  appt.status === "checked_in" && appt.checkedInAt
                    ? Math.max(
                        differenceInMinutes(
                          nowDate,
                          new Date(appt.checkedInAt),
                        ),
                        0,
                      )
                    : null;
                return (
                  <div
                    key={appt.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{appt.patientName}</p>
                        <StatusBadge status={appt.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>
                          {appt.doctorName} •{" "}
                          {format(
                            new Date(appt.appointmentDate),
                            "MMM d, h:mm a",
                          )}
                        </span>
                        {appt.patientPhone && (
                          <span
                            dir="ltr"
                            className="inline-flex items-center gap-1 text-xs tabular-nums"
                          >
                            <Phone className="h-3 w-3" />
                            {appt.patientPhone}
                          </span>
                        )}
                        {waitMins !== null && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                            <Clock className="h-3 w-3" />
                            {t("waiting")}: {waitMins} {t("minsShort")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      {renderRowActions(appt.id, appt.patientName, appt.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {bookingContext && (
        <>
          <BookingCreateDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            context={bookingContext}
          />
          <BookingDetailSheet
            bookingId={sheetState.id}
            initialTab={sheetState.tab}
            open={sheetState.open}
            onOpenChange={(next) => {
              if (!next) {
                setSheetState({ id: null, tab: "view", open: false });
              }
            }}
            context={bookingContext}
          />
        </>
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
