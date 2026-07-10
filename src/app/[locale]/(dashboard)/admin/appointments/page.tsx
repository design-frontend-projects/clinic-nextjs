"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppointments, updateAppointmentStatus } from "@/app/actions/admin";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const queryClient = useQueryClient();

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
      header: "Patient",
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
              {row.original.patients?.phone || "No phone"}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "profiles",
      header: "Doctor",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.profiles?.full_name || "Unassigned"}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.profiles?.specialty || ""}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "appointment_date",
      header: "Date & Time",
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
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
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
              Check In
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
              Complete
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
              Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground">
            Manage all clinic appointments
          </p>
        </div>
        <Button onClick={() => setIsNewAppointmentOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Appointment
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

      <DataTable columns={columns} data={appointments as Appointment[]} />
    </div>
  );
}
