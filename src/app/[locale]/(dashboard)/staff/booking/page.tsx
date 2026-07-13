"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus, CalendarDays, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import {
  getStaffAppointments,
  createStaffAppointment,
  registerPatientAndCreateStaffAppointment,
} from "@/app/actions/staff";
import type {
  AppointmentStatus,
  StaffAppointmentRow,
} from "@/types/staff.types";

const INVALIDATE_KEYS = [
  "staff-appointments",
  "staff-dashboard",
  "staff-queue",
];

const STATUS_FILTERS: Array<{ value: string; labelKey: string }> = [
  { value: "all", labelKey: "filterAll" },
  { value: "scheduled", labelKey: "statusScheduled" },
  { value: "checked_in", labelKey: "statusCheckedIn" },
  { value: "completed", labelKey: "statusCompleted" },
  { value: "cancelled", labelKey: "statusCancelled" },
  { value: "no_show", labelKey: "statusNoShow" },
];

export default function StaffBookingPage() {
  const t = useTranslations("pages.staff");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["staff-appointments", statusFilter],
    queryFn: () =>
      getStaffAppointments({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const columns: ColumnDef<StaffAppointmentRow>[] = [
    {
      accessorKey: "appointmentDate",
      header: t("colDateTime"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {format(new Date(row.original.appointmentDate), "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(row.original.appointmentDate), "h:mm a")}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "patientName",
      header: t("colPatient"),
    },
    {
      accessorKey: "doctorName",
      header: t("colDoctor"),
    },
    {
      accessorKey: "visitType",
      header: t("colVisitType"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.visitType || "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("colStatus"),
      cell: ({ row }) => (
        <StatusBadge status={row.original.status as AppointmentStatus} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("bookingTitle")}
          </h1>
          <p className="text-muted-foreground">{t("bookingSubtitle")}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newAppointment")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="h-fit w-full shrink-0 rounded-xl border bg-card p-4 md:w-64">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="font-semibold">{t("scheduleFilter")}</span>
          </div>
          <label className="mb-1.5 block text-sm text-muted-foreground">
            {t("colStatus")}
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {t(f.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={appointments}
              searchKey="patientName"
              searchPlaceholder={t("searchBookings")}
            />
          )}
        </div>
      </div>

      <NewAppointmentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateAppointment={createStaffAppointment}
        onRegisterPatient={registerPatientAndCreateStaffAppointment}
        invalidateKeys={INVALIDATE_KEYS}
      />
    </div>
  );
}
