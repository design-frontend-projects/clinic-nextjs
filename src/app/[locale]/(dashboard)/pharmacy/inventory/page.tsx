"use client";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowRightLeft } from "lucide-react";

import { useTranslations } from "next-intl";

type InventoryItem = {
  id: string;
  medication: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  status: string; // 'in_stock', 'low_stock', 'expired'
};

const getColumns = (t: any): ColumnDef<InventoryItem>[] => [
  {
    accessorKey: "medication",
    header: t("table.medication"),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.medication}</span>
    ),
  },
  {
    accessorKey: "batchNumber",
    header: t("table.batchNumber"),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.batchNumber}</span>
    ),
  },
  {
    accessorKey: "quantity",
    header: t("table.quantity"),
    cell: ({ row }) => (
      <span
        className={`font-semibold ${row.original.quantity < 20 ? "text-destructive" : ""}`}
      >
        {row.original.quantity}{t("table.units")}
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
        <ArrowRightLeft className="mr-2 h-4 w-4" />
        {t("table.transfer")}
      </Button>
    ),
  },
];

export default function PharmacyInventoryPage() {
  const t = useTranslations("pharmacy.inventory");
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
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="medication"
        searchPlaceholder={t("searchStock")}
      />
    </div>
  );
}
