"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { getStaffInvoices } from "@/app/actions/staff";
import type { StaffInvoiceRow } from "@/types/staff.types";

export default function StaffBillingPage() {
  const t = useTranslations("pages.staff");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["staff-invoices"],
    queryFn: () => getStaffInvoices(),
  });

  const columns: ColumnDef<StaffInvoiceRow>[] = [
    {
      accessorKey: "invoiceNumber",
      header: t("colInvoiceNumber"),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.invoiceNumber}</span>
      ),
    },
    {
      accessorKey: "patientName",
      header: t("colPatient"),
    },
    {
      accessorKey: "amount",
      header: t("colAmount"),
      cell: ({ row }) => (
        <span className="font-medium">${row.original.amount.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "issuedAt",
      header: t("colDateIssued"),
      cell: ({ row }) => format(new Date(row.original.issuedAt), "MMM d, yyyy"),
    },
    {
      accessorKey: "status",
      header: t("colStatus"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("billingTitle")}
          </h1>
          <p className="text-muted-foreground">{t("billingSubtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          searchKey="patientName"
          searchPlaceholder={t("searchInvoices")}
        />
      )}
    </div>
  );
}
