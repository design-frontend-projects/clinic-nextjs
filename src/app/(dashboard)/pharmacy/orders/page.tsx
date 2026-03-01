"use client";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus, Eye } from "lucide-react";

type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplier: string;
  orderDate: Date;
  totalAmount: number;
  status: string; // 'draft', 'pending', 'received', 'cancelled'
};

const columns: ColumnDef<PurchaseOrder>[] = [
  {
    accessorKey: "orderNumber",
    header: "Order #",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.orderNumber}</span>
    ),
  },
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.supplier}</span>
    ),
  },
  {
    accessorKey: "orderDate",
    header: "Date Issued",
    cell: ({ row }) => format(new Date(row.original.orderDate), "MMM d, yyyy"),
  },
  {
    accessorKey: "totalAmount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium">
        ${row.original.totalAmount.toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm">
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
];

export default function PharmacyOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage medication orders and track deliveries from suppliers
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="supplier"
        searchPlaceholder="Search by supplier..."
      />
    </div>
  );
}
