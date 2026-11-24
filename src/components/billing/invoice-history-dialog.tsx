"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Loader2, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { getInvoiceHistory } from "@/app/actions/billing";
import type {
  InvoiceHistorySnapshot,
  PaymentMethod,
} from "@/types/billing.types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface InvoiceHistoryDialogProps {
  invoiceId: string | null;
  invoiceNumber?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SnapshotCard({
  label,
  snapshot,
  t,
}: {
  label: string;
  snapshot: InvoiceHistorySnapshot;
  t: ReturnType<typeof useTranslations<"admin.billing">>;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/25 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Badge variant="outline" className="capitalize text-[10px]">
          {snapshot.status}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("history.grossLabel")}</span>
          <span className="font-medium">${snapshot.total_amount.toFixed(2)}</span>
        </div>
        {snapshot.insurance_deduction > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>{t("history.insuranceLabel")}</span>
            <span className="font-medium">
              −${snapshot.insurance_deduction.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("history.netLabel")}</span>
          <span className="font-semibold">${snapshot.net_amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("history.paidLabel")}</span>
          <span className="font-semibold">${snapshot.paid_amount.toFixed(2)}</span>
        </div>
      </div>

      {snapshot.items && snapshot.items.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-1">
          <p className="font-medium text-muted-foreground">
            {t("history.itemsLabel")}
          </p>
          <ul className="space-y-1">
            {snapshot.items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {item.description} ({item.quantity} × ${item.unit_price.toFixed(2)})
                </span>
                <span className="font-mono shrink-0">
                  ${item.total_price.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function InvoiceHistoryDialog({
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
}: InvoiceHistoryDialogProps) {
  const t = useTranslations("admin.billing");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["invoice-history", invoiceId],
    queryFn: () => getInvoiceHistory(invoiceId!),
    enabled: open && !!invoiceId,
  });

  const actionMeta: Record<string, { label: string; className: string }> = {
    created: {
      label: t("history.actionCreated"),
      className: "bg-accent-blue-soft text-accent-blue border-0",
    },
    updated: {
      label: t("history.actionUpdated"),
      className: "bg-muted text-foreground border-0",
    },
    marked_paid: {
      label: t("history.actionMarkedPaid"),
      className: "bg-accent-green-soft text-accent-green border-0",
    },
    edited_after_paid: {
      label: t("history.actionEditedAfterPaid"),
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0",
    },
  };

  const methodLabels: Record<PaymentMethod, string> = {
    cash: t("paymentMethods.cash"),
    card: t("paymentMethods.card"),
    bank_transfer: t("paymentMethods.bank_transfer"),
    insurance: t("paymentMethods.insurance"),
    other: t("paymentMethods.other"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {t("history.title")}
            {invoiceNumber ? ` — ${invoiceNumber}` : ""}
          </DialogTitle>
          <DialogDescription>{t("history.subtitle")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>{t("history.loading")}</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("history.empty")}
          </p>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const meta = actionMeta[entry.action] ?? {
                label: entry.action,
                className: "bg-muted text-foreground border-0",
              };
              const method = entry.new_data?.payment_method as
                | PaymentMethod
                | undefined;

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={meta.className}>{meta.label}</Badge>
                      {method && (
                        <Badge variant="outline" className="text-[11px]">
                          {t("history.paymentMethodLabel")}:{" "}
                          {methodLabels[method] ?? method}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        new Date(entry.created_at),
                        "MMM d, yyyy h:mm a",
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">
                      {entry.changed_by_name || "System"}
                    </span>
                    {entry.changed_by_role && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] capitalize"
                      >
                        {entry.changed_by_role}
                      </Badge>
                    )}
                  </div>

                  {entry.reason && (
                    <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-xs">
                      <span className="font-semibold text-foreground">
                        {t("history.reasonLabel")}:{" "}
                      </span>
                      <span className="text-muted-foreground">{entry.reason}</span>
                    </div>
                  )}

                  {(entry.previous_data || entry.new_data) && (
                    <>
                      <Separator />
                      <div
                        className={
                          entry.previous_data && entry.new_data
                            ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                            : "grid grid-cols-1 gap-3"
                        }
                      >
                        {entry.previous_data && (
                          <SnapshotCard
                            label={t("history.beforeLabel")}
                            snapshot={entry.previous_data}
                            t={t}
                          />
                        )}
                        {entry.new_data && (
                          <SnapshotCard
                            label={t("history.afterLabel")}
                            snapshot={entry.new_data}
                            t={t}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
