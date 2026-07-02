"use client";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowRightLeft } from "lucide-react";

type InventoryItem = {
  id: string;
  medication: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  status: string; // 'in_stock', 'low_stock', 'expired'
};

const columns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: "medication",
    header: "Medication",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.medication}</span>
    ),
  },
  {
    accessorKey: "batchNumber",
    header: "Batch #",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.batchNumber}</span>
    ),
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => (
      <span
        className={`font-semibold ${row.original.quantity < 20 ? "text-destructive" : ""}`}
      >
        {row.original.quantity} units
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
        <ArrowRightLeft className="mr-2 h-4 w-4" />
        Transfer
      </Button>
    ),
  },
];

export default function PharmacyInventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Inventory</h1>
          <p className="text-muted-foreground">
            Manage medication batches and stock levels
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="medication"
        searchPlaceholder="Search stock..."
      />
    </div>
  );
}
