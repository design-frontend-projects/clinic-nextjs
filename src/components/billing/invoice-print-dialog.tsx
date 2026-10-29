"use client";

import { useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Mail, MessageCircle, Printer, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getInvoiceDetails,
  sendInvoiceEmail,
  sendInvoiceWhatsApp,
} from "@/app/actions/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface InvoicePrintDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoicePrintDialog({
  invoiceId,
  open,
  onOpenChange,
}: InvoicePrintDialogProps) {
  const t = useTranslations("admin.billing");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const { data: details, isLoading } = useQuery({
    queryKey: ["invoice-details", invoiceId],
    queryFn: () => getInvoiceDetails(invoiceId!),
    enabled: open && !!invoiceId,
  });

  const handlePrintPdf = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    if (!invoiceId) return;
    startTransition(async () => {
      const res = await sendInvoiceWhatsApp(invoiceId, locale);
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

  const handleSendEmail = () => {
    if (!invoiceId) return;
    startTransition(async () => {
      const res = await sendInvoiceEmail(invoiceId, locale);
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

  const patientName = details?.patient
    ? `${details.patient.first_name || ""} ${details.patient.last_name || ""}`.trim()
    : t("table.walkIn");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>{t("print.title")}</DialogTitle>
          <DialogDescription>{t("print.subtitle")}</DialogDescription>
        </DialogHeader>

        {isLoading || !details ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div
            id="printable-invoice"
            dir={locale === "ar" ? "rtl" : "ltr"}
            className="space-y-6 rounded-lg border bg-background p-6 print:border-0 print:p-0"
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {details.clinic.name}
                </h2>
                {details.clinic.phone && (
                  <p className="text-xs text-muted-foreground">
                    {details.clinic.phone}
                  </p>
                )}
                {details.clinic.email && (
                  <p className="text-xs text-muted-foreground">
                    {details.clinic.email}
                  </p>
                )}
              </div>
              <div className="text-right rtl:text-left">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("table.invoice")}
                </p>
                <p className="font-mono text-lg font-bold">
                  {details.invoice_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(details.created_at), "MMM d, yyyy")}
                </p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {details.status}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Patient & Insurance metadata */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {t("table.patient")}
                </p>
                <p className="font-semibold">{patientName}</p>
                {details.patient?.phone && (
                  <p className="text-xs text-muted-foreground">
                    {details.patient.phone}
                  </p>
                )}
                {details.patient?.email && (
                  <p className="text-xs text-muted-foreground">
                    {details.patient.email}
                  </p>
                )}
              </div>

              {details.insurance_provider_name && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {t("table.insurance")}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold">
                      {details.insurance_provider_name}
                    </span>
                  </div>
                  {details.policy_number && (
                    <p className="text-xs text-muted-foreground">
                      Policy #{details.policy_number}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left rtl:text-right">
                      {t("print.colDescription")}
                    </th>
                    <th className="px-3 py-2.5 text-left rtl:text-right">
                      {t("catalog.colCategory")}
                    </th>
                    <th className="px-3 py-2.5 text-center">
                      {t("print.colQty")}
                    </th>
                    <th className="px-3 py-2.5 text-right rtl:text-left">
                      {t("print.colUnitPrice")}
                    </th>
                    <th className="px-3 py-2.5 text-right rtl:text-left">
                      {t("print.colTotal")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {details.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5 font-medium">
                        {item.description}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {t(`categories.${item.category}`)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-right rtl:text-left">
                        ${item.unit_price.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium rtl:text-left">
                        ${item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("dialog.total")}
                  </span>
                  <span className="font-medium">
                    ${details.total_amount.toFixed(2)}
                  </span>
                </div>
                {details.insurance_deduction > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>
                      {t("dialog.insuranceDeduction")}
                      {details.insurance_provider_name
                        ? ` (${details.insurance_provider_name})`
                        : ""}
                    </span>
                    <span className="font-medium">
                      −${details.insurance_deduction.toFixed(2)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>{t("table.patientPays")}</span>
                  <span>${details.net_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={handleSendWhatsApp}
            disabled={isPending || !details?.patient?.phone}
            title={
              !details?.patient?.phone
                ? t("actions.noPatientPhone")
                : undefined
            }
          >
            <MessageCircle className="mr-2 h-4 w-4 text-emerald-600" />
            {t("actions.sendWhatsApp")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSendEmail}
            disabled={isPending || !details?.patient?.email}
            title={
              !details?.patient?.email
                ? t("actions.noPatientEmail")
                : undefined
            }
          >
            <Mail className="mr-2 h-4 w-4 text-sky-600" />
            {t("actions.sendEmail")}
          </Button>
          <Button
            type="button"
            onClick={handlePrintPdf}
            disabled={!details}
          >
            <Printer className="mr-2 h-4 w-4" />
            {t("actions.printPdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

