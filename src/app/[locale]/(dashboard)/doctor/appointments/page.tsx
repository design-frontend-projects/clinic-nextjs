"use client";

import { useQuery } from "@tanstack/react-query";
import { getDoctorAppointments } from "@/app/actions/doctor";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { useAppointmentsRealtime } from "@/lib/appointments/use-appointments-realtime";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronRight, Users, FlaskConical, TestTube } from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { AddLabRequestDialog } from "@/components/doctor/add-lab-request-dialog";
import {
  AppointmentDateFilter,
  DEFAULT_APPT_FILTER,
  type ApptDateFilter,
} from "@/components/appointments/appointment-date-filter";

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: Date | null;
  gender: string | null;
};

type Appointment = {
  id: string;
  appointment_date: Date;
  status: string;
  notes: string | null;
  patients: Patient | null;
};

export default function DoctorAppointmentsPage() {
  const [dateFilter, setDateFilter] =
    useState<ApptDateFilter>(DEFAULT_APPT_FILTER);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [labRequestFor, setLabRequestFor] = useState<{
    appointmentId: string;
    patientName: string;
  } | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  useAppointmentsRealtime(tenant?.clinicId);

  const { data: appointments = [] } = useQuery({
    queryKey: ["doctor-appointments", dateFilter, statusFilter],
    queryFn: () =>
      getDoctorAppointments({
        mode: dateFilter.mode,
        date: dateFilter.date,
        status: statusFilter,
      }),
  });

  const columns = useMemo<ColumnDef<Appointment>[]>(
    () => [
      {
        accessorKey: "appointment_date",
        header: "Time",
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-bold">
              {format(new Date(row.original.appointment_date), "h:mm a")}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(row.original.appointment_date), "MMM d, yyyy")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "patients",
        header: "Patient",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {row.original.patients?.first_name}{" "}
                {row.original.patients?.last_name}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="capitalize">
                  {row.original.patients?.gender || "Unknown"}
                </span>
                {row.original.patients?.date_of_birth && (
                  <>
                    <span>•</span>
                    <span>
                      DOB:{" "}
                      {format(
                        new Date(row.original.patients.date_of_birth),
                        "yyyy-MM-dd",
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
            {row.original.notes || "—"}
          </p>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const isCompleted = row.original.status === "completed";
          const patientName = `${row.original.patients?.first_name ?? ""} ${
            row.original.patients?.last_name ?? ""
          }`.trim();

          return (
            <div className="flex items-center justify-end gap-1">
              <Link href={`/doctor/lab-orders?appointmentId=${row.original.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  title="View this appointment's labs"
                >
                  <TestTube className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">View Labs</span>
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                disabled={isCompleted}
                title={
                  isCompleted
                    ? "Appointment completed"
                    : "Add a lab request"
                }
                onClick={() =>
                  setLabRequestFor({
                    appointmentId: row.original.id,
                    patientName,
                  })
                }
              >
                <FlaskConical className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Lab Request</span>
              </Button>

              {isCompleted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  title="Appointment completed"
                >
                  <span className="hidden md:inline">Consultation</span>
                  <ChevronRight className="h-4 w-4 md:ml-2" />
                </Button>
              ) : (
                <Link
                  href={`/doctor/patients/${row.original.patients?.id}?appointmentId=${row.original.id}`}
                >
                  <Button variant="ghost" size="sm" className="hidden md:flex">
                    Consultation <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
          <p className="text-muted-foreground">
            Manage your daily schedule and consultations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentDateFilter value={dateFilter} onChange={setDateFilter} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable columns={columns} data={appointments as Appointment[]} />

      <AddLabRequestDialog
        appointmentId={labRequestFor?.appointmentId ?? null}
        patientName={labRequestFor?.patientName ?? ""}
        open={labRequestFor !== null}
        onOpenChange={(next) => {
          if (!next) setLabRequestFor(null);
        }}
      />
    </div>
  );
}
