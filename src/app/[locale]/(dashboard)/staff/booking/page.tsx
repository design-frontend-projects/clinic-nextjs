"use client";

import { Button } from "@/components/ui/button";
import { Plus, CalendarDays } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

type Booking = {
  id: string;
  patient: string;
  doctor: string;
  date: Date;
  status: string;
  type: string;
};

const columns: ColumnDef<Booking>[] = [
  {
    accessorKey: "date",
    header: "Date & Time",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">
          {format(new Date(row.original.date), "MMM d, yyyy")}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(row.original.date), "h:mm a")}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "patient",
    header: "Patient",
  },
  {
    accessorKey: "doctor",
    header: "Doctor",
  },
  {
    accessorKey: "type",
    header: "Visit Type",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export default function StaffBookingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Booking Central</h1>
          <p className="text-muted-foreground">
            Schedule and manage patient appointments
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Placeholder for calendar/date picker filter */}
        <div className="w-full md:w-64 border rounded-xl p-4 bg-card h-fit shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="font-semibold">Schedule Filter</span>
          </div>
          <div className="h-64 border-dashed border-2 rounded-lg flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Calendar Map</span>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 min-w-0">
          <DataTable
            columns={columns}
            data={[]}
            searchKey="patient"
            searchPlaceholder="Search bookings..."
          />
        </div>
      </div>
    </div>
  );
}
