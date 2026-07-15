"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/app/actions/admin";
import { CreateInvoiceDialog } from "@/components/billing/create-invoice-dialog";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Receipt, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

type Invoice = {
  id: string;
  invoice_type: string | null;
  total_amount: number | null;
  status: string;
  created_at: Date;
  patients: { first_name: string | null; last_name: string | null } | null;
  payments: { id: string; amount: number | null; status: string }[];
  insurance_claims: {
    id: string;
    claim_amount: number | null;
    status: string;
    patient_insurances: {
      insurance_providers: { name: string } | null;
    } | null;
  }[];
};

function insuranceTotal(invoice: Invoice): number {
  return invoice.insurance_claims.reduce(
    (sum, claim) => sum + Number(claim.claim_amount || 0),
    0,
  );
}

// Moved inside component

export default function BillingPage() {
  const t = useTranslations("admin.billing");
  const [createOpen, setCreateOpen] = useState(false);

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: "id",
      header: t("table.invoice"),
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
              {row.original.invoice_type || t("table.general")}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "patients",
      header: t("table.patient"),
      cell: ({ row }) =>
        row.original.patients
          ? `${row.original.patients.first_name || ""} ${row.original.patients.last_name || ""}`.trim()
          : t("table.walkIn"),
    },
    {
      accessorKey: "total_amount",
      header: t("table.amount"),
      cell: ({ row }) => (
        <p className="font-semibold">
          ${Number(row.original.total_amount || 0).toFixed(2)}
        </p>
      ),
    },
    {
      id: "insurance",
      header: t("table.insurance"),
      cell: ({ row }) => {
        const covered = insuranceTotal(row.original);
        if (covered <= 0) return <span className="text-muted-foreground">—</span>;
        const provider =
          row.original.insurance_claims[0]?.patient_insurances
            ?.insurance_providers?.name;
        return (
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-600">
                −${covered.toFixed(2)}
              </p>
              {provider && (
                <p className="text-xs text-muted-foreground">{provider}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "patient_pays",
      header: t("table.patientPays"),
      cell: ({ row }) => (
        <p className="font-semibold">
          $
          {Math.max(
            0,
            Number(row.original.total_amount || 0) - insuranceTotal(row.original),
          ).toFixed(2)}
        </p>
      ),
    },
    {
      accessorKey: "status",
      header: t("table.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "paid",
      header: t("table.paid"),
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
      header: t("table.date"),
      cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
    },
  ];

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => getInvoices(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createInvoice")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={invoices as Invoice[]}
        searchKey="id"
        searchPlaceholder={t("searchInvoices")}
      />

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
