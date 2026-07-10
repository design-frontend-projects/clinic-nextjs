"use client";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, FlaskConical } from "lucide-react";
import { format } from "date-fns";

type LabOrder = {
  id: string;
  patient_name: string;
  test_type: string;
  created_at: Date;
  status: string;
  priority: string;
};

const columns: ColumnDef<LabOrder>[] = [
  {
    accessorKey: "test_type",
    header: "Test Type",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/30">
          <FlaskConical className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <p className="font-medium">{row.original.test_type}</p>
          <p className="text-xs text-muted-foreground">
            Priority: {row.original.priority}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "patient_name",
    header: "Patient",
  },
  {
    accessorKey: "created_at",
    header: "Order Date",
    cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export default function DoctorLabOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Orders</h1>
          <p className="text-muted-foreground">
            Manage lab tests and view results
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Request Test
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
