"use client";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus, Eye } from "lucide-react";

import { useTranslations } from "next-intl";

type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplier: string;
  orderDate: Date;
  totalAmount: number;
  status: string; // 'draft', 'pending', 'received', 'cancelled'
};

const getColumns = (t: any): ColumnDef<PurchaseOrder>[] => [
  {
    accessorKey: "orderNumber",
    header: t("table.orderNumber"),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.orderNumber}</span>
    ),
  },
  {
    accessorKey: "supplier",
    header: t("table.supplier"),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.supplier}</span>
    ),
  },
  {
    accessorKey: "orderDate",
    header: t("table.dateIssued"),
    cell: ({ row }) => format(new Date(row.original.orderDate), "MMM d, yyyy"),
  },
  {
    accessorKey: "totalAmount",
    header: t("table.amount"),
    cell: ({ row }) => (
      <span className="font-medium">
        ${row.original.totalAmount.toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: t("table.status"),
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
  const t = useTranslations("pharmacy.orders");
  const columns = getColumns(t);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("createOrder")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="supplier"
        searchPlaceholder={t("searchSupplier")}
      />
    </div>
  );
}
