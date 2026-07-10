"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CheckCircle2, Clock } from "lucide-react";

type QueueItem = {
  id: string;
  patient: string;
  doctor: string;
  appointmentTime: Date;
  status: string; // e.g., 'scheduled', 'waiting', 'in_progress'
  waitTimeMins?: number;
};

const columns: ColumnDef<QueueItem>[] = [
  {
    accessorKey: "patient",
    header: "Patient",
    cell: ({ row }) => <p className="font-medium">{row.original.patient}</p>,
  },
  {
    accessorKey: "doctor",
    header: "Doctor",
  },
  {
    accessorKey: "appointmentTime",
    header: "Time",
    cell: ({ row }) => format(new Date(row.original.appointmentTime), "h:mm a"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "wait_time",
    header: "Wait Time",
    cell: ({ row }) => {
      if (row.original.status === "waiting" && row.original.waitTimeMins) {
        return (
          <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
            <Clock className="h-4 w-4" />
            <span className="font-medium">{row.original.waitTimeMins}m</span>
          </div>
        );
      }
      return <span className="text-muted-foreground">-</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      // If scheduled, show 'Check In' button. Else show disabled or nothing.
      const isScheduled = row.original.status === "scheduled";
      return (
        <Button
          variant={isScheduled ? "default" : "secondary"}
          size="sm"
          disabled={!isScheduled}
        >
          {isScheduled ? (
            <>
              <CheckCircle2 className="mr-2 w-4 h-4" />
              Check In
            </>
          ) : (
            "Done"
          )}
        </Button>
      );
    },
  },
];

export default function CheckinQueuePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check-In Queue</h1>
          <p className="text-muted-foreground">
            Manage arriving patients and track wait times
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="patient"
        searchPlaceholder="Filter by patient name..."
      />
    </div>
  );
}
