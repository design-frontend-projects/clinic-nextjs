"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppointments, updateAppointmentStatus } from "@/app/actions/admin";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { useAppointmentsRealtime } from "@/lib/appointments/use-appointments-realtime";
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
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });
  const role = tenant?.role;

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
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
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
            {format(new Date(row.original.appointment_date), "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(row.original.appointment_date), "h:mm a")}
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
        // A completed appointment is locked for non-admin tenant users (e.g. owner):
        // they cannot check in / complete / cancel it. Admins keep full control.
        const isCompleted = row.original.status === "completed";
        if (isCompleted && role !== "admin") {
          return <span className="text-muted-foreground">—</span>;
        }

        return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                statusMutation.mutate({
                  id: row.original.id,
                  status: "checked_in",
                })
              }
            >
              <LogIn className="mr-2 h-4 w-4" />
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
              <CheckCircle className="mr-2 h-4 w-4" />
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
              <XCircle className="mr-2 h-4 w-4" />
              {t("cancel")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        );
      },
    },
  ];

// Moved inside component

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={() => setIsNewAppointmentOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newAppointment")}
        </Button>
      </div>

      <NewAppointmentDialog
        open={isNewAppointmentOpen}
        onOpenChange={setIsNewAppointmentOpen}
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
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
