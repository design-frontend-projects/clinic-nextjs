"use client";

import { useQuery } from "@tanstack/react-query";
import { getDoctorAppointments } from "@/app/actions/doctor";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useState } from "react";

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

const columns: ColumnDef<Appointment>[] = [
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
    cell: ({ row }) => (
      <Link href={`/doctor/patients/${row.original.patients?.id}`}>
        <Button variant="ghost" size="sm" className="hidden md:flex">
          Consultation <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    ),
  },
];

export default function DoctorAppointmentsPage() {
  const [dateFilter, setDateFilter] = useState<string>("");

  const { data: appointments = [] } = useQuery({
    queryKey: ["doctor-appointments", dateFilter],
    queryFn: () => getDoctorAppointments(dateFilter),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
          <p className="text-muted-foreground">
            Manage your daily schedule and consultations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" onClick={() => setDateFilter("")}>
            Clear
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={appointments as Appointment[]}
        // We add search by accessing the nested patient name object properties if TanStack allows,
        // but TanStack usually needs custom filterFn for nested objects.
        // We'll leave the search out for now or define a flat search state.
      />
    </div>
  );
}
