"use client";

import { useQuery } from "@tanstack/react-query";
import { getDoctorLabOrders } from "@/app/actions/doctor";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { FlaskConical, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";

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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-yellow-soft text-accent-yellow font-semibold">
          <FlaskConical className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">{row.original.test_name}</p>
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
    cell: ({ row }) => (
      <span className="font-semibold text-sm text-foreground">{row.original.patient_name}</span>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Order Date",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(row.original.created_at), "MMM d, yyyy")}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export default function DoctorLabOrdersPage() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") ?? undefined;

  const { data: labOrders = [], isLoading } = useQuery({
    queryKey: ["doctor-lab-orders", appointmentId ?? "all"],
    queryFn: () => getDoctorLabOrders(appointmentId),
  });

  const rows: LabOrderRow[] = labOrders.map((order) => ({
    id: order.id,
    test_name: order.test_name || "—",
    external_lab_provider: order.external_lab_provider || "",
    patient_name: `${order.patients?.first_name ?? ""} ${
      order.patients?.last_name ?? ""
    }`.trim() || "Unknown patient",
    created_at: order.created_at.toISOString(),
    status: order.status,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent">
            Lab Orders
          </h1>
          <p className="text-muted-foreground">
            Lab requests you raised from appointments, and their results
          </p>
        </div>
      </div>

      {appointmentId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border/60 bg-muted/40 px-4 py-2.5 text-sm backdrop-blur-md">
          <span className="text-muted-foreground font-medium">
            Showing labs for the selected appointment.
          </span>
          <Link href="/doctor/lab-orders">
            <Button variant="ghost" size="sm" className="rounded-lg hover:bg-muted text-xs font-semibold">
              <X className="mr-1.5 h-4 w-4" />
              Clear filter
            </Button>
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
          <span className="text-sm font-medium">Loading lab orders...</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-md shadow-sm">
          <DataTable
            columns={columns}
            data={rows}
            searchKey="patient_name"
            searchPlaceholder="Search by patient name..."
          />
        </div>
      )}
    </motion.div>
  );
}
