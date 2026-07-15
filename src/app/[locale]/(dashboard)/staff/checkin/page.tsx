"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { differenceInMinutes, format } from "date-fns";
import { CheckCircle2, Clock, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LiveBadge } from "@/components/ui/live-badge";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import {
  getStaffQueue,
  checkInStaffAppointment,
  updateStaffAppointmentStatus,
  createStaffAppointment,
  registerPatientAndCreateStaffAppointment,
} from "@/app/actions/staff";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { useAppointmentsRealtime } from "@/lib/appointments/use-appointments-realtime";
import type { StaffQueueItem } from "@/types/staff.types";

const INVALIDATE_KEYS = ["staff-queue", "staff-dashboard"];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function CheckinQueuePage() {
  const t = useTranslations("pages.staff");
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  // Live check-ins/creations from any client update the queue instantly; the
  // 60s interval below remains a fallback that also keeps wait-times fresh.
  useAppointmentsRealtime(tenant?.clinicId, {
    onCheckIn: () => toast.success(t("checkedInLive")),
  });

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["staff-queue"],
    queryFn: () => getStaffQueue(),
    // Keep wait-times reasonably fresh without a hard refresh.
    refetchInterval: 60_000,
  });

  function invalidateQueue() {
    for (const key of INVALIDATE_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const checkInMutation = useMutation({
    mutationFn: (id: string) => checkInStaffAppointment(id),
    onSuccess: () => {
      toast.success(t("checkedInToast"));
      invalidateQueue();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateStaffAppointmentStatus(id, "completed"),
    onSuccess: () => {
      toast.success(t("completedToast"));
      invalidateQueue();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const pendingId =
    (checkInMutation.isPending && checkInMutation.variables) ||
    (completeMutation.isPending && completeMutation.variables) ||
    null;

  const columns: ColumnDef<StaffQueueItem>[] = [
    {
      accessorKey: "patientName",
      header: t("colPatient"),
      cell: ({ row }) => (
        <p className="font-medium">{row.original.patientName}</p>
      ),
    },
    {
      accessorKey: "doctorName",
      header: t("colDoctor"),
    },
    {
      accessorKey: "appointmentDate",
      header: t("colTime"),
      cell: ({ row }) =>
        format(new Date(row.original.appointmentDate), "h:mm a"),
    },
    {
      accessorKey: "status",
      header: t("colStatus"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "wait_time",
      header: t("colWaitTime"),
      cell: ({ row }) => {
        const { status, checkedInAt } = row.original;
        if (status === "checked_in" && checkedInAt) {
          const mins = Math.max(
            differenceInMinutes(new Date(), new Date(checkedInAt)),
            0,
          );
          return (
            <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
              <Clock className="h-4 w-4" />
              <span className="font-medium">
                {mins}
                {t("minsShort")}
              </span>
            </div>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const { id, status } = row.original;
        const isBusy = pendingId === id;

        if (status === "scheduled") {
          return (
            <Button
              size="sm"
              disabled={isBusy}
              onClick={() => checkInMutation.mutate(id)}
            >
              {isBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {t("checkIn")}
            </Button>
          );
        }

        return (
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => completeMutation.mutate(id)}
          >
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("markComplete")}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {t("checkInTitle")}
            </h1>
            <LiveBadge />
          </div>
          <p className="text-muted-foreground">{t("checkInSubtitle")}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newAppointment")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={queue}
          searchKey="patientName"
          searchPlaceholder={t("filterByPatient")}
        />
      )}

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
