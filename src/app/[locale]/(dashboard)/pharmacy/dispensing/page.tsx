"use client";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { PackageOpen } from "lucide-react";
import { format } from "date-fns";

type DispenseRequest = {
  id: string;
  prescriptionId: string;
  patientName: string;
  doctorName: string;
  date: Date;
  status: string; // 'pending', 'dispensed', 'cancelled'
};

const columns: ColumnDef<DispenseRequest>[] = [
  {
    accessorKey: "patientName",
    header: "Patient",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.patientName}</span>
    ),
  },
  {
    accessorKey: "doctorName",
    header: "Prescribed By",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        Dr. {row.original.doctorName}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) =>
      format(new Date(row.original.date), "MMM d, yyyy h:mm a"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button
        variant={row.original.status === "pending" ? "default" : "secondary"}
        size="sm"
        disabled={row.original.status !== "pending"}
      >
        <PackageOpen className="mr-2 h-4 w-4" />
        Dispense
      </Button>
    ),
  },
];

export default function PharmacyDispensingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Prescription Dispensing
          </h1>
          <p className="text-muted-foreground">
            Review prescriptions from doctors and dispense medications
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="patientName"
        searchPlaceholder="Search by patient..."
      />
    </div>
  );
}
