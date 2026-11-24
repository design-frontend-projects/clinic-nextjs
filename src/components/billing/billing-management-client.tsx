"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  History,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { getInvoices } from "@/app/actions/admin";
import {
  sendInvoiceEmail,
  sendInvoiceWhatsApp,
} from "@/app/actions/billing";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import {
  canEditInvoice,
  canMarkInvoiceAsPaid,
} from "@/lib/invoice-permissions";
import type { InvoiceListRow } from "@/types/billing.types";
import { BillingCatalogTab } from "@/components/billing/billing-catalog-tab";
import { CreateInvoiceDialog } from "@/components/billing/create-invoice-dialog";
import {
  EditInvoiceDialog,
  type EditableInvoiceTarget,
} from "@/components/billing/edit-invoice-dialog";
import { InvoiceHistoryDialog } from "@/components/billing/invoice-history-dialog";
import { InvoicePrintDialog } from "@/components/billing/invoice-print-dialog";
import {
  MarkPaidDialog,
  type MarkPaidTarget,
} from "@/components/billing/mark-paid-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

function insuranceTotal(invoice: InvoiceListRow): number {
  return invoice.insurance_claims.reduce(
    (sum, claim) => sum + Number(claim.claim_amount || 0),
    0,
  );
}

export function BillingManagementClient() {
  const t = useTranslations("admin.billing");
  const locale = useLocale();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] =
    useState<EditableInvoiceTarget | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<MarkPaidTarget | null>(
    null,
  );
  const [historyInvoice, setHistoryInvoice] = useState<{
    id: string;
    invoiceNumber: string;
  } | null>(null);
  const [printingInvoiceId, setPrintingInvoiceId] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => getInvoices(),
  });

  const actor = tenant
    ? { profileId: tenant.profileId, role: tenant.role }
    : null;

  const openMarkPaidDialog = (row: InvoiceListRow) => {
    const patientName = row.patients
      ? `${row.patients.first_name || ""} ${row.patients.last_name || ""}`.trim()
      : t("table.walkIn");
    const gross = Math.round(Number(row.total_amount || 0) * 100) / 100;
    const deduction = Math.round(insuranceTotal(row) * 100) / 100;
    const net = Math.round(Math.max(0, gross - deduction) * 100) / 100;
    const alreadyPaid =
      Math.round(
        row.payments
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100,
      ) / 100;

    setPayingInvoice({
      id: row.id,
      invoice_number: row.invoice_number,
      patient_name: patientName,
      gross,
      insurance_deduction: deduction,
      net_amount: net,
      already_paid: alreadyPaid,
    });
  };

  const handleQuickWhatsApp = (invoice: InvoiceListRow) => {
    startTransition(async () => {
      const res = await sendInvoiceWhatsApp(invoice.id, locale);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (res.mode === "fallback" && res.fallbackUrl) {
        window.open(res.fallbackUrl, "_blank", "noopener,noreferrer");
        toast.success(res.message || t("actions.whatsappOpened"));
      } else {
        toast.success(res.message || t("actions.whatsappSent"));
      }
    });
  };

  const handleQuickEmail = (invoice: InvoiceListRow) => {
    startTransition(async () => {
      const res = await sendInvoiceEmail(invoice.id, locale);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (res.mode === "fallback" && res.fallbackUrl) {
        window.location.href = res.fallbackUrl;
        toast.success(res.message || t("actions.emailOpened"));
      } else {
        toast.success(res.message || t("actions.emailSent"));
      }
    });
  };

  const openEditDialog = (row: InvoiceListRow) => {
    const patientName = row.patients
      ? `${row.patients.first_name || ""} ${row.patients.last_name || ""}`.trim()
      : t("table.walkIn");

    setEditingInvoice({
      id: row.id,
      invoice_number: row.invoice_number,
      status: row.status,
      patient_id: row.patients?.id ?? row.patient_id ?? null,
      patient_name: patientName,
      has_insurance_claim: insuranceTotal(row) > 0,
      items: row.invoice_items.map((it) => ({
        id: it.id,
        catalog_item_id: it.catalog_item_id ?? null,
        category: it.category ?? "other",
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
    });
  };

  const columns: ColumnDef<InvoiceListRow>[] = [
    {
      accessorKey: "id",
      header: t("table.invoice"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Receipt className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="font-mono text-sm font-medium">
              {row.original.invoice_number ||
                row.original.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-xs capitalize text-muted-foreground">
              {row.original.invoice_type || t("table.general")}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "patients",
      header: t("table.patient"),
      cell: ({ row }) => {
        const p = row.original.patients;
        if (!p) return t("table.walkIn");
        return (
          <div>
            <p className="font-medium text-sm">
              {`${p.first_name || ""} ${p.last_name || ""}`.trim()}
            </p>
            {(p.phone || p.email) && (
              <p className="text-xs text-muted-foreground">
                {p.phone || p.email}
              </p>
            )}
          </div>
        );
      },
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
        if (covered <= 0) {
          return <span className="text-muted-foreground">—</span>;
        }
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
            Number(row.original.total_amount || 0) -
              insuranceTotal(row.original),
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
        const netPayable = Math.max(
          0,
          Number(row.original.total_amount || 0) - insuranceTotal(row.original),
        );
        const diff = Math.round((netPayable - totalPaid) * 100) / 100;
        return (
          <div>
            <p className="text-sm">
              ${totalPaid.toFixed(2)}{" "}
              <span className="text-muted-foreground">
                / ${netPayable.toFixed(2)}
              </span>
            </p>
            {row.original.status === "paid" && diff >= 0.01 && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                {t("history.balanceDue", { amount: diff.toFixed(2) })}
              </p>
            )}
            {row.original.status === "paid" && diff <= -0.01 && (
              <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                {t("history.overpaid", { amount: Math.abs(diff).toFixed(2) })}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: t("table.date"),
      cell: ({ row }) =>
        format(new Date(row.original.created_at), "MMM d, yyyy"),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const inv = row.original;
        const canPay = canMarkInvoiceAsPaid(inv, actor);
        const canEdit = canEditInvoice(inv, actor);
        const editTooltip =
          inv.status === "cancelled"
            ? t("actions.editLockedCancelled")
            : inv.status === "paid"
              ? canEdit
                ? t("actions.editPaidAsCreator")
                : t("actions.editLockedPaidCreatorOnly")
              : t("actions.editItems");

        return (
          <div className="flex items-center justify-end gap-1">
            {canPay && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openMarkPaidDialog(inv)}
                title={t("actions.markAsPaid")}
                aria-label={t("actions.markAsPaid")}
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              disabled={!canEdit}
              onClick={() => openEditDialog(inv)}
              title={editTooltip}
              aria-label={t("actions.editItems")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setHistoryInvoice({
                  id: inv.id,
                  invoiceNumber:
                    inv.invoice_number || inv.id.slice(0, 8).toUpperCase(),
                })
              }
              title={t("actions.viewHistory")}
              aria-label={t("actions.viewHistory")}
            >
              <History className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPrintingInvoiceId(inv.id)}
              title={t("actions.printPdf")}
              aria-label={t("actions.printPdf")}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isPending || !inv.patients?.phone}
              onClick={() => handleQuickWhatsApp(inv)}
              title={
                inv.patients?.phone
                  ? t("actions.sendWhatsApp")
                  : t("actions.noPatientPhone")
              }
              aria-label={t("actions.sendWhatsApp")}
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isPending || !inv.patients?.email}
              onClick={() => handleQuickEmail(inv)}
              title={
                inv.patients?.email
                  ? t("actions.sendEmail")
                  : t("actions.noPatientEmail")
              }
              aria-label={t("actions.sendEmail")}
            >
              <Mail className="h-4 w-4 text-sky-600" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createInvoice")}
        </Button>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            {t("tabs.invoices")}
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2">
            <Tags className="h-4 w-4" />
            {t("tabs.catalog")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <DataTable
            columns={columns}
            data={invoices}
            searchKey="id"
            searchPlaceholder={t("searchInvoices")}
          />
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <BillingCatalogTab />
        </TabsContent>
      </Tabs>

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditInvoiceDialog
        invoice={editingInvoice}
        open={!!editingInvoice}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
      />

      <MarkPaidDialog
        invoice={payingInvoice}
        open={!!payingInvoice}
        onOpenChange={(open) => !open && setPayingInvoice(null)}
      />

      <InvoiceHistoryDialog
        invoiceId={historyInvoice?.id ?? null}
        invoiceNumber={historyInvoice?.invoiceNumber ?? null}
        open={!!historyInvoice}
        onOpenChange={(open) => !open && setHistoryInvoice(null)}
      />

      <InvoicePrintDialog
        invoiceId={printingInvoiceId}
        open={!!printingInvoiceId}
        onOpenChange={(open) => !open && setPrintingInvoiceId(null)}
      />
    </div>
  );
}

