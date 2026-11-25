"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { format, isToday, isTomorrow } from "date-fns";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Eye,
  LayoutGrid,
  Loader2,
  LogIn,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Table2,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { usePathname, useRouter } from "@/i18n/routing";
import {
  cancelBooking,
  getBookingContext,
  getBookings,
  updateBooking,
} from "@/app/actions/booking";
import {
  APPOINTMENT_KEYS,
  useAppointmentsRealtime,
} from "@/lib/appointments/use-appointments-realtime";
import type { BookingItem, BookingRoleScope } from "@/types/booking.types";
import type { AppointmentStatus } from "@/types/staff.types";

import {
  AppointmentDateFilter,
  type ApptDateFilter,
} from "@/components/appointments/appointment-date-filter";
import { BookingCard } from "@/components/bookings/booking-card";
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
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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

interface BookingHubClientProps {
  variant?: "shared" | "staff";
}

const STATUS_OPTIONS = [
  "all",
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

export function BookingHubClient({ variant = "shared" }: BookingHubClientProps) {
  const t = useTranslations("pages.booking");
  const tStatus = useTranslations("enums.status");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"agenda" | "table">("agenda");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [dateFilterOverride, setDateFilterOverride] =
    useState<ApptDateFilter | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [sheetState, setSheetState] = useState<{
    id: string | null;
    tab: "view" | "edit";
    open: boolean;
  }>({ id: null, tab: "view", open: false });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: context, isLoading: isContextLoading } = useQuery({
    queryKey: ["booking-context"],
    queryFn: () => getBookingContext(),
  });

  useAppointmentsRealtime(context?.clinicId);

  const defaultDateFilter: ApptDateFilter = useMemo(
    () => ({
      mode: context?.roleScope === "patient" ? "upcoming" : "today",
    }),
    [context?.roleScope],
  );
  const effectiveDateFilter = dateFilterOverride ?? defaultDateFilter;

  const { data: bookingsResult, isLoading: isBookingsLoading } = useQuery({
    queryKey: [
      "bookings",
      {
        status: statusFilter,
        doctorId: doctorFilter,
        range: effectiveDateFilter.mode,
        date: effectiveDateFilter.date,
        search: debouncedSearch,
      },
    ],
    queryFn: () =>
      getBookings({
        status: statusFilter,
        doctorId: doctorFilter,
        range: effectiveDateFilter.mode,
        date: effectiveDateFilter.date,
        search: debouncedSearch || undefined,
      }),
    enabled: Boolean(context),
  });

  // Derive deep-link open state from URL query params (?id=<uuid> or ?action=new)
  const deepLinkId = searchParams.get("id");
  const deepLinkAction = searchParams.get("action");

  const effectiveSheetOpen = sheetState.open || Boolean(deepLinkId);
  const effectiveBookingId = sheetState.open ? sheetState.id : deepLinkId;
  const effectiveSheetTab = sheetState.open ? sheetState.tab : "view";
  const effectiveCreateOpen =
    isCreateOpen || (deepLinkAction === "new" && Boolean(context?.canCreate));

  function clearUrlParam(param: string) {
    if (!searchParams.has(param)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleOpenSheet(id: string, tab: "view" | "edit") {
    setSheetState({ id, tab, open: true });
  }

  function handleSheetOpenChange(next: boolean) {
    if (next) {
      setSheetState((prev) => ({ ...prev, open: true }));
      return;
    }
    setSheetState({ id: null, tab: "view", open: false });
    clearUrlParam("id");
  }

  function handleCreateOpenChange(next: boolean) {
    setIsCreateOpen(next);
    if (!next) {
      clearUrlParam("action");
    }
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookings });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingDetail });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingSlots });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffAppointments });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffDashboard });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffQueue });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.doctor });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.admin });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.patientUpcoming });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.patientHistory });
  }

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      status === "cancelled"
        ? cancelBooking(id)
        : updateBooking({ id, status }),
    onSuccess: (result, variables) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setPendingCancelId(null);
      invalidateAll();
      toast.success(
        variables.status === "cancelled"
          ? t("toastCancelled")
          : t("toastStatusUpdated"),
      );
    },
  });

  const items = useMemo(
    () => bookingsResult?.items ?? [],
    [bookingsResult?.items],
  );
  const stats = bookingsResult?.stats ?? {
    todayCount: 0,
    upcomingCount: 0,
    scheduledCount: 0,
    checkedInCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalCount: 0,
  };

  const roleScope: BookingRoleScope = context?.roleScope ?? "staff";
  const isPatient = roleScope === "patient";

  const headerCopy = useMemo(() => {
    if (variant === "staff" || roleScope === "staff") {
      return { title: t("staffTitle"), subtitle: t("staffSubtitle") };
    }
    if (roleScope === "patient") {
      return { title: t("patientTitle"), subtitle: t("patientSubtitle") };
    }
    if (roleScope === "doctor") {
      return { title: t("doctorTitle"), subtitle: t("doctorSubtitle") };
    }
    return { title: t("adminTitle"), subtitle: t("adminSubtitle") };
  }, [variant, roleScope, t]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; bookings: BookingItem[] }
    >();
    for (const item of items) {
      const date = new Date(item.appointmentDate);
      const dayKey = format(date, "yyyy-MM-dd");
      if (!groups.has(dayKey)) {
        let label = format(date, "EEEE, MMM d, yyyy");
        if (isToday(date)) label = t("groupToday");
        else if (isTomorrow(date)) label = t("groupTomorrow");
        groups.set(dayKey, { label, bookings: [] });
      }
      groups.get(dayKey)!.bookings.push(item);
    }
    return Array.from(groups.entries());
  }, [items, t]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    doctorFilter !== "all" ||
    Boolean(debouncedSearch) ||
    Boolean(effectiveDateFilter.date) ||
    effectiveDateFilter.mode !== defaultDateFilter.mode;

  function resetFilters() {
    setStatusFilter("all");
    setDoctorFilter("all");
    setSearchInput("");
    setDebouncedSearch("");
    setDateFilterOverride(null);
  }

  const columns: ColumnDef<BookingItem>[] = useMemo(() => {
    const cols: ColumnDef<BookingItem>[] = [
      {
        accessorKey: "appointmentDate",
        header: t("colDateTime"),
        cell: ({ row }) => {
          const d = new Date(row.original.appointmentDate);
          return (
            <div>
              <p className="font-medium text-foreground">
                {format(d, "MMM d, yyyy")}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {format(d, "h:mm a")}
              </p>
            </div>
          );
        },
      },
    ];

    if (!isPatient) {
      cols.push({
        id: "patientName",
        accessorFn: (row) => row.patient.fullName,
        header: t("colPatient"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.patient.fullName}
            </p>
            {row.original.patient.phone && (
              <p className="text-xs text-muted-foreground">
                {row.original.patient.phone}
              </p>
            )}
          </div>
        ),
      });
    }

    cols.push(
      {
        id: "doctorName",
        accessorFn: (row) => row.doctor?.fullName ?? "",
        header: t("colDoctor"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.doctor?.fullName || t("unassignedDoctor")}
            </p>
            {row.original.doctor?.specialty && (
              <p className="text-xs text-muted-foreground">
                {row.original.doctor.specialty}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "branchName",
        accessorFn: (row) => row.branch?.name ?? "",
        header: t("colBranch"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.branch?.name || "—"}
          </span>
        ),
      },
      {
        accessorKey: "notes",
        header: t("colNotes"),
        cell: ({ row }) => (
          <p className="max-w-[200px] truncate text-sm text-muted-foreground">
            {row.original.notes || "—"}
          </p>
        ),
      },
      {
        accessorKey: "status",
        header: t("colStatus"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: t("colActions"),
        cell: ({ row }) => {
          const item = row.original;
          const { capabilities } = item;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenSheet(item.id, "view")}
              >
                <Eye className="me-1.5 h-3.5 w-3.5" />
                {t("actionView")}
              </Button>
              {capabilities.canEditDetails && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenSheet(item.id, "edit")}
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
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleOpenSheet(item.id, "view")}
                  >
                    <Eye className="me-2 h-4 w-4" />
                    {t("actionView")}
                  </DropdownMenuItem>
                  {capabilities.canEditDetails && (
                    <DropdownMenuItem
                      onClick={() => handleOpenSheet(item.id, "edit")}
                    >
                      <Pencil className="me-2 h-4 w-4" />
                      {t("actionEdit")}
                    </DropdownMenuItem>
                  )}
                  {capabilities.canCheckIn && (
                    <DropdownMenuItem
                      onClick={() =>
                        transitionMutation.mutate({
                          id: item.id,
                          status: "checked_in",
                        })
                      }
                    >
                      <LogIn className="me-2 h-4 w-4" />
                      {t("actionCheckIn")}
                    </DropdownMenuItem>
                  )}
                  {capabilities.canComplete && (
                    <DropdownMenuItem
                      onClick={() =>
                        transitionMutation.mutate({
                          id: item.id,
                          status: "completed",
                        })
                      }
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
                        onClick={() => setPendingCancelId(item.id)}
                      >
                        <XCircle className="me-2 h-4 w-4" />
                        {t("actionCancel")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    );

    return cols;
  }, [isPatient, t, transitionMutation]);

  if (isContextLoading || !context) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {headerCopy.title}
            </h1>
            <LiveBadge />
          </div>
          <p className="text-sm text-muted-foreground">{headerCopy.subtitle}</p>
        </div>

        {context.canCreate && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("newBookingCta")}
          </Button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isPatient ? t("kpiUpcoming") : t("kpiToday")}
          value={isPatient ? stats.upcomingCount : stats.todayCount}
          icon={CalendarDays}
        />
        <StatCard
          title={t("kpiScheduled")}
          value={stats.scheduledCount}
          icon={CalendarClock}
        />
        <StatCard
          title={isPatient ? t("kpiCompleted") : t("kpiCheckedIn")}
          value={isPatient ? stats.completedCount : stats.checkedInCount}
          icon={isPatient ? CalendarCheck : UserCheck}
        />
        <StatCard
          title={isPatient ? t("kpiCancelled") : t("kpiCompleted")}
          value={isPatient ? stats.cancelledCount : stats.completedCount}
          icon={isPatient ? XCircle : CheckCircle2}
        />
      </div>

      {/* Filter Bar */}
      <Card className="py-0">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="ps-9 pe-8"
                />
                {searchInput && (
                  <button
                    type="button"
                    aria-label={t("clearSearch")}
                    onClick={() => {
                      setSearchInput("");
                      setDebouncedSearch("");
                    }}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t("statusFilterPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st === "all" ? t("allStatuses") : tStatus(st)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Doctor filter */}
              {roleScope !== "doctor" && context.doctors.length > 0 && (
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t("doctorFilterPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allDoctors")}</SelectItem>
                    {context.doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-2 self-end lg:self-auto">
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                >
                  <RotateCcw className="me-1.5 h-3.5 w-3.5" />
                  {t("resetFilters")}
                </Button>
              )}
              <div className="inline-flex rounded-[var(--radius-button)] border border-hairline bg-canvas-soft p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "agenda" ? "default" : "ghost"}
                  onClick={() => setViewMode("agenda")}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="me-1.5 h-3.5 w-3.5" />
                  {t("viewAgenda")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  onClick={() => setViewMode("table")}
                  className="h-8 px-3"
                >
                  <Table2 className="me-1.5 h-3.5 w-3.5" />
                  {t("viewTable")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
            <AppointmentDateFilter
              value={effectiveDateFilter}
              onChange={(next) => setDateFilterOverride(next)}
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("resultsCount", { count: items.length })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      {isBookingsLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {t("emptyTitle")}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {hasActiveFilters
                  ? t("emptyFilteredSubtitle")
                  : t("emptySubtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw className="me-1.5 h-3.5 w-3.5" />
                  {t("resetFilters")}
                </Button>
              )}
              {context.canCreate && (
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="me-1.5 h-3.5 w-3.5" />
                  {t("newBookingCta")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "agenda" ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {groupedByDay.map(([dayKey, group]) => (
            <section key={dayKey} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("resultsCount", { count: group.bookings.length })}
                </span>
              </div>
              <div className="space-y-2.5">
                {group.bookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    roleScope={roleScope}
                    onOpen={handleOpenSheet}
                    onStatusTransition={(id, status) =>
                      transitionMutation.mutate({ id, status })
                    }
                    onRequestCancel={(id) => setPendingCancelId(id)}
                    isUpdating={transitionMutation.isPending}
                  />
                ))}
              </div>
            </section>
          ))}
        </motion.div>
      ) : (
        <DataTable columns={columns} data={items} />
      )}

      {/* Slide-over Detail & Edit Sheet */}
      <BookingDetailSheet
        bookingId={effectiveBookingId}
        initialTab={effectiveSheetTab}
        open={effectiveSheetOpen}
        onOpenChange={handleSheetOpenChange}
        context={context}
      />

      {/* Create Booking Dialog */}
      <BookingCreateDialog
        open={effectiveCreateOpen}
        onOpenChange={handleCreateOpenChange}
        context={context}
      />

      {/* Quick Cancel Confirmation */}
      <AlertDialog
        open={pendingCancelId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingCancelId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepBooking")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={transitionMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pendingCancelId) return;
                transitionMutation.mutate({
                  id: pendingCancelId,
                  status: "cancelled",
                });
              }}
            >
              {transitionMutation.isPending && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {t("confirmCancelButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
