"use client";

import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/app/actions/admin";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Receipt } from "lucide-react";
import { format } from "date-fns";

type Invoice = {
  id: string;
  invoice_type: string | null;
  total_amount: number | null;
  status: string;
  created_at: Date;
  patients: { first_name: string | null; last_name: string | null } | null;
  payments: { id: string; amount: number | null; status: string }[];
};

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "id",
    header: "Invoice",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Receipt className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="font-medium font-mono text-sm">
            {row.original.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {row.original.invoice_type || "General"}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "patients",
    header: "Patient",
    cell: ({ row }) =>
      row.original.patients
        ? `${row.original.patients.first_name || ""} ${row.original.patients.last_name || ""}`.trim()
        : "Walk-in",
  },
  {
    accessorKey: "total_amount",
    header: "Amount",
    cell: ({ row }) => (
      <p className="font-semibold">
        ${Number(row.original.total_amount || 0).toFixed(2)}
      </p>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "paid",
    header: "Paid",
    cell: ({ row }) => {
      const totalPaid = row.original.payments
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return (
        <p className="text-sm">
          ${totalPaid.toFixed(2)}{" "}
          <span className="text-muted-foreground">
            / ${Number(row.original.total_amount || 0).toFixed(2)}
          </span>
        </p>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
  },
];

export default function BillingPage() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => getInvoices(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Billing & Invoices
          </h1>
          <p className="text-muted-foreground">Track invoices and payments</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={invoices as Invoice[]}
        searchKey="id"
        searchPlaceholder="Search invoices..."
      />
    </div>
  );
}
