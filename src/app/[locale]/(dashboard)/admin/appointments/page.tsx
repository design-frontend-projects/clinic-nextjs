"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppointments, updateAppointmentStatus } from "@/app/actions/admin";
import { getBookingContext } from "@/app/actions/booking";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import {
  APPOINTMENT_KEYS,
  useAppointmentsRealtime,
} from "@/lib/appointments/use-appointments-realtime";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  CalendarDays,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  LogIn,
  Pencil,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { BookingCreateDialog } from "@/components/bookings/booking-create-dialog";
import { BookingDetailSheet } from "@/components/bookings/booking-detail-sheet";

type Appointment = {
  id: string;
  appointment_date: Date;
  status: string;
  notes: string | null;
  patients: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
  profiles: { full_name: string | null; specialty: string | null } | null;
};

export default function AppointmentsPage() {
  const t = useTranslations("admin.appointments");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? arLocale : undefined;
  const [statusFilter, setStatusFilter] = useState("all");
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [sheetState, setSheetState] = useState<{
    id: string | null;
    tab: "view" | "edit";
    open: boolean;
  }>({ id: null, tab: "view", open: false });
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const { data: bookingContext } = useQuery({
    queryKey: ["booking-context"],
    queryFn: () => getBookingContext(),
  });

  useAppointmentsRealtime(tenant?.clinicId);

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", statusFilter],
    queryFn: () =>
      getAppointments({
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.admin });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookings });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingDetail });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingSlots });
      queryClient.invalidateQueries({
        queryKey: APPOINTMENT_KEYS.staffAppointments,
      });
      queryClient.invalidateQueries({
        queryKey: APPOINTMENT_KEYS.staffDashboard,
      });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffQueue });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.doctor });
    },
  });

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "patients",
      header: t("table.patient"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">
              {row.original.patients?.first_name}{" "}
              {row.original.patients?.last_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.patients?.phone || t("table.noPhone")}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "profiles",
      header: t("table.doctor"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.profiles?.full_name || t("table.unassigned")}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.profiles?.specialty || ""}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "appointment_date",
      header: t("table.dateTime"),
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">
            {format(new Date(row.original.appointment_date), "MMM d, yyyy", {
              locale: dateLocale,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            <span dir="ltr">
              {format(new Date(row.original.appointment_date), "h:mm a", {
                locale: dateLocale,
              })}
            </span>
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: t("table.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!bookingContext}
              onClick={() =>
                setSheetState({ id: row.original.id, tab: "edit", open: true })
              }
            >
              <Pencil className="me-1.5 h-3.5 w-3.5" />
              {t("edit")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!bookingContext}
                  onClick={() =>
                    setSheetState({
                      id: row.original.id,
                      tab: "view",
                      open: true,
                    })
                  }
                >
                  <Eye className="me-2 h-4 w-4" />
                  {t("viewDetails")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!bookingContext}
                  onClick={() =>
                    setSheetState({
                      id: row.original.id,
                      tab: "edit",
                      open: true,
                    })
                  }
                >
                  <Pencil className="me-2 h-4 w-4" />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({
                      id: row.original.id,
                      status: "checked_in",
                    })
                  }
                >
                  <LogIn className="me-2 h-4 w-4" />
                  {t("checkIn")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({
                      id: row.original.id,
                      status: "completed",
                    })
                  }
                >
                  <CheckCircle className="me-2 h-4 w-4" />
                  {t("complete")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() =>
                    statusMutation.mutate({
                      id: row.original.id,
                      status: "cancelled",
                    })
                  }
                >
                  <XCircle className="me-2 h-4 w-4" />
                  {t("cancel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

// Moved inside component

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setIsNewAppointmentOpen(true)}
        >
          <Plus className="me-2 h-4 w-4" />
          {t("newAppointment")}
        </Button>
      </div>

      {bookingContext && (
        <>
          <BookingCreateDialog
            open={isNewAppointmentOpen}
            onOpenChange={setIsNewAppointmentOpen}
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="scheduled">{t("statusScheduled")}</SelectItem>
            <SelectItem value="checked_in">{t("statusCheckedIn")}</SelectItem>
            <SelectItem value="completed">{t("statusCompleted")}</SelectItem>
            <SelectItem value="cancelled">{t("statusCancelled")}</SelectItem>
            <SelectItem value="no_show">{t("statusNoShow")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={appointments as Appointment[]} />
    </div>
  );
}
