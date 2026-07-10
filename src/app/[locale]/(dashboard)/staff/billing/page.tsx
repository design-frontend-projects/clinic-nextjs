"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus, CreditCard } from "lucide-react";

type Invoice = {
  id: string;
  invoiceNumber: string;
  patient: string;
  amount: number;
  date: Date;
  status: string; // 'paid', 'pending', 'overdue'
};

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Invoice #",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.invoiceNumber}</span>
    ),
  },
  {
    accessorKey: "patient",
    header: "Patient",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium">${row.original.amount.toFixed(2)}</span>
    ),
  },
  {
    accessorKey: "date",
    header: "Date Issued",
    cell: ({ row }) => format(new Date(row.original.date), "MMM d, yyyy"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" className="hidden sm:flex">
        <CreditCard className="mr-2 h-4 w-4" />
        Process Payment
      </Button>
    ),
  },
];

export default function StaffBillingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Billing & Invoices
          </h1>
          <p className="text-muted-foreground">
            Generate invoices and process patient payments
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="patient"
        searchPlaceholder="Search invoices by patient..."
      />
    </div>
  );
}
