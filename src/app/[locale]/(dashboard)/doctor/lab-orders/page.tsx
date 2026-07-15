"use client";

import { useQuery } from "@tanstack/react-query";
import { getDoctorLabOrders } from "@/app/actions/doctor";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { FlaskConical } from "lucide-react";
import { format } from "date-fns";

type LabOrderRow = {
  id: string;
  test_name: string;
  external_lab_provider: string;
  patient_name: string;
  created_at: string;
  status: string;
};

const columns: ColumnDef<LabOrderRow>[] = [
  {
    accessorKey: "test_name",
    header: "Test",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/30">
          <FlaskConical className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <p className="font-medium">{row.original.test_name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.external_lab_provider || "In-house"}
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
  const { data: labOrders = [] } = useQuery({
    queryKey: ["doctor-lab-orders"],
    queryFn: () => getDoctorLabOrders(),
  });

  const rows: LabOrderRow[] = labOrders.map((order) => ({
    id: order.id,
    test_name: order.test_name || "—",
    external_lab_provider: order.external_lab_provider || "",
    patient_name: `${order.patients?.first_name ?? ""} ${
      order.patients?.last_name ?? ""
    }`.trim(),
    created_at: order.created_at.toISOString(),
    status: order.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Orders</h1>
          <p className="text-muted-foreground">
            Lab requests you raised from appointments, and their results
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchKey="patient_name"
        searchPlaceholder="Search by patient name..."
      />
    </div>
  );
}
