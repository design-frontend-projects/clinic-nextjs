"use client";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { PackageOpen } from "lucide-react";
import { format } from "date-fns";

import { useTranslations } from "next-intl";

type DispenseRequest = {
  id: string;
  prescriptionId: string;
  patientName: string;
  doctorName: string;
  date: Date;
  status: string; // 'pending', 'dispensed', 'cancelled'
};

const getColumns = (t: any): ColumnDef<DispenseRequest>[] => [
  {
    accessorKey: "patientName",
    header: t("table.patient"),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.patientName}</span>
    ),
  },
  {
    accessorKey: "doctorName",
    header: t("table.prescribedBy"),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {t("table.drPrefix")}{row.original.doctorName}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: t("table.date"),
    cell: ({ row }) =>
      format(new Date(row.original.date), "MMM d, yyyy h:mm a"),
  },
  {
    accessorKey: "status",
    header: t("table.status"),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button
        variant={row.original.status === "pending" ? "default" : "secondary"}
        size="sm"
        disabled={row.original.status !== "pending"}
      >
        <PackageOpen className="mr-2 h-4 w-4" />
        {t("table.dispense")}
      </Button>
    ),
  },
];

export default function PharmacyDispensingPage() {
  const t = useTranslations("pharmacy.dispensing");
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
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="patientName"
        searchPlaceholder={t("searchPatient")}
      />
    </div>
  );
}
