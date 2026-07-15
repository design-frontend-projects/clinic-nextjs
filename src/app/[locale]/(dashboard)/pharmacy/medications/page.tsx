"use client";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pill } from "lucide-react";

import { useTranslations } from "next-intl";

type Medication = {
  id: string;
  name: string;
  genericName: string;
  category: string;
  form: string; // e.g., 'Tablet', 'Syrup'
  strength: string;
};

const getColumns = (t: any): ColumnDef<Medication>[] => [
  {
    accessorKey: "name",
    header: t("table.medicationName"),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="font-medium text-blue-600 dark:text-blue-400">
            {row.original.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.genericName}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: t("table.category"),
  },
  {
    accessorKey: "form",
    header: t("table.form"),
  },
  {
    accessorKey: "strength",
    header: t("table.strength"),
  },
];

export default function PharmacyMedicationsPage() {
  const t = useTranslations("pharmacy.medications");
  const columns = getColumns(t);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("addMedication")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="name"
        searchPlaceholder={t("searchMedications")}
      />
    </div>
  );
}
