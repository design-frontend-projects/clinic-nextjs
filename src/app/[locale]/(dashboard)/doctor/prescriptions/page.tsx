"use client";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pill } from "lucide-react";
import { format } from "date-fns";

type Prescription = {
  id: string;
  patient_name: string;
  medication: string;
  dosage: string;
  frequency: string;
  issue_date: Date;
  status: string;
};

const columns: ColumnDef<Prescription>[] = [
  {
    accessorKey: "medication",
    header: "Medication",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/30">
          <Pill className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <p className="font-medium">{row.original.medication}</p>
          <p className="text-xs text-muted-foreground">{row.original.dosage}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "patient_name",
    header: "Patient",
  },
  {
    accessorKey: "frequency",
    header: "Frequency",
  },
  {
    accessorKey: "issue_date",
    header: "Date Issued",
    cell: ({ row }) => format(new Date(row.original.issue_date), "MMM d, yyyy"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export default function DoctorPrescriptionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prescriptions</h1>
          <p className="text-muted-foreground">
            Manage your issued patient prescriptions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Prescription
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="patient_name"
        searchPlaceholder="Search by patient name..."
      />
    </div>
  );
}
