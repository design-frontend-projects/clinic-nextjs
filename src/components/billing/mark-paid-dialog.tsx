"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { markInvoiceAsPaid } from "@/app/actions/billing";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/types/billing.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export type MarkPaidTarget = {
  id: string;
  invoice_number?: string | null;
  patient_name: string;
  gross: number;
  insurance_deduction: number;
  net_amount: number;
  already_paid: number;
};

interface MarkPaidDialogProps {
  invoice: MarkPaidTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MarkPaidDialogContent({
  invoice,
  onOpenChange,
}: {
  invoice: MarkPaidTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.billing");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const amountToCollect =
    Math.round(Math.max(0, invoice.net_amount - invoice.already_paid) * 100) /
    100;

  const methodLabels: Record<PaymentMethod, string> = {
    cash: t("paymentMethods.cash"),
    card: t("paymentMethods.card"),
    bank_transfer: t("paymentMethods.bank_transfer"),
    insurance: t("paymentMethods.insurance"),
    other: t("paymentMethods.other"),
  };

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await markInvoiceAsPaid({
        invoice_id: invoice.id,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("markPaid.toastSuccess"));
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({
        queryKey: ["invoice-details", invoice.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["invoice-history", invoice.id],
      });
      queryClient.invalidateQueries({ queryKey: ["staff-invoices"] });
      onOpenChange(false);
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {t("markPaid.title")} —{" "}
          {invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()}
        </DialogTitle>
        <DialogDescription>
          {t("markPaid.description", { patient: invoice.patient_name })}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("markPaid.grossTotal")}
            </span>
            <span className="font-medium">${invoice.gross.toFixed(2)}</span>
          </div>
          {invoice.insurance_deduction > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>{t("markPaid.insuranceDeduction")}</span>
              <span className="font-medium">
                −${invoice.insurance_deduction.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("markPaid.netPayable")}
            </span>
            <span className="font-medium">
              ${invoice.net_amount.toFixed(2)}
            </span>
          </div>
          {invoice.already_paid > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("markPaid.alreadyPaid")}
              </span>
              <span className="font-medium">
                ${invoice.already_paid.toFixed(2)}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-bold pt-1">
            <span>{t("markPaid.amountToCollect")}</span>
            <span className="text-emerald-600">
              ${amountToCollect.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t("markPaid.methodLabel")}</Label>
          <Select
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {methodLabels[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("markPaid.notesLabel")}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("markPaid.notesPlaceholder")}
            className="min-h-[72px]"
            disabled={isPending}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("markPaid.processing")}
            </>
          ) : (
            <>
              <CheckCircle2 className="me-2 h-4 w-4" />
              {t("markPaid.confirmButton")}
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function MarkPaidDialog({
  invoice,
  open,
  onOpenChange,
}: MarkPaidDialogProps) {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <MarkPaidDialogContent
          key={invoice.id}
          invoice={invoice}
          onOpenChange={onOpenChange}
        />
      )}
    </Dialog>
  );
}
