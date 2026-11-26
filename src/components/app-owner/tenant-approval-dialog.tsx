"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Loader2, XCircle } from "lucide-react";

import {
  approveTenantRequest,
  rejectTenantRequest,
} from "@/app/actions/app-owner/tenants";
import { getSubscriptionPlans } from "@/app/actions/app-owner/plans";
import { subscriptionWindow } from "@/lib/subscription-provisioning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BILLING_CYCLES = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "lifetime",
] as const;

type BillingCycle = (typeof BILLING_CYCLES)[number];
type ClinicActivationStatus = "active" | "trial";
type PaymentStatusOption = "paid" | "pending";

interface TenantApprovalDialogProps {
  tenant: {
    id: string;
    name: string;
    status: string;
    request_ref: string | null;
    created_at: string;
    email: string | null;
    phone: string | null;
  };
  owner: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  initialSubscription: {
    plan_id: string;
    plan_name: string | null;
    billing_cycle: string;
    price: number;
    currency: string;
    grace_period_days: number;
  } | null;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeAutoEndDate(startStr: string, cycle: BillingCycle): string {
  if (cycle === "lifetime" || !startStr) return "";
  const start = new Date(`${startStr}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return "";
  const { endDate } = subscriptionWindow(cycle, start);
  return endDate ? toDateInputValue(endDate) : "";
}

export function TenantApprovalDialog({
  tenant,
  owner,
  initialSubscription,
}: TenantApprovalDialogProps) {
  const router = useRouter();
  const t = useTranslations("appOwner.approvalDialog");
  const tPeriods = useTranslations("appOwner.planEditor.periods");

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultStart = toDateInputValue(new Date());
  const defaultCycle = (
    BILLING_CYCLES.includes(initialSubscription?.billing_cycle as BillingCycle)
      ? initialSubscription?.billing_cycle
      : "monthly"
  ) as BillingCycle;

  const [planId, setPlanId] = useState(initialSubscription?.plan_id ?? "");
  const [clinicStatus, setClinicStatus] =
    useState<ClinicActivationStatus>("active");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(defaultCycle);
  const [price, setPrice] = useState(
    String(initialSubscription?.price ?? 0),
  );
  const [discount, setDiscount] = useState("");
  const [currency, setCurrency] = useState(
    initialSubscription?.currency ?? "USD",
  );
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(
    computeAutoEndDate(defaultStart, defaultCycle),
  );
  const [gracePeriodDays, setGracePeriodDays] = useState(
    String(initialSubscription?.grace_period_days ?? 7),
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusOption>(
    Number(initialSubscription?.price ?? 0) === 0 ? "paid" : "paid",
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => getSubscriptionPlans(),
    enabled: open,
  });

  const resolvedPlanId = planId || plans[0]?.id || "";

  const handlePlanChange = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    const matched = plans.find((p) => p.id === nextPlanId);
    if (!matched) return;
    const nextCycle = (
      BILLING_CYCLES.includes(matched.billing_period as BillingCycle)
        ? matched.billing_period
        : "monthly"
    ) as BillingCycle;
    setBillingCycle(nextCycle);
    setPrice(String(Number(matched.price)));
    setCurrency(matched.currency || "USD");
    setEndDate(computeAutoEndDate(startDate, nextCycle));
  };

  const handleCycleChange = (nextCycle: BillingCycle) => {
    setBillingCycle(nextCycle);
    setEndDate(computeAutoEndDate(startDate, nextCycle));
  };

  const handleStartDateChange = (nextStart: string) => {
    setStartDate(nextStart);
    setEndDate(computeAutoEndDate(nextStart, billingCycle));
  };

  const handleApprove = () => {
    if (!resolvedPlanId) {
      toast.error(t("selectPlanRequired"));
      return;
    }
    startTransition(async () => {
      const res = await approveTenantRequest({
        tenantId: tenant.id,
        planId: resolvedPlanId,
        clinicStatus,
        billingCycle,
        price: Number(price || 0),
        discount: discount ? Number(discount) : null,
        currency: currency || "USD",
        startDate,
        endDate: billingCycle === "lifetime" ? null : endDate || null,
        gracePeriodDays: Number(gracePeriodDays || 0),
        paymentStatus,
        paymentReference: paymentReference.trim() || null,
        notes: notes.trim() || null,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("approvedToast"));
      setOpen(false);
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const res = await rejectTenantRequest({
        tenantId: tenant.id,
        reason: rejectionReason.trim() || null,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("rejectedToast"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5" />
          {t("reviewButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-start">
          <div className="flex flex-wrap items-center gap-2 pe-7">
            <DialogTitle>{tenant.name}</DialogTitle>
            <StatusBadge status={tenant.status} />
          </div>
          <DialogDescription>
            {tenant.request_ref
              ? `${t("refLabel")}: ${tenant.request_ref}`
              : t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2.5 rounded-[var(--radius-button)] border border-hairline bg-canvas-soft p-3.5 text-xs sm:grid-cols-2 dark:bg-surface-elevated">
          <div className="min-w-0">
            <span className="text-muted-foreground">{t("ownerLabel")}: </span>
            <span className="font-medium text-foreground">
              {owner?.full_name || "—"}
            </span>
          </div>
          <div className="min-w-0 truncate">
            <span className="text-muted-foreground">{t("emailLabel")}: </span>
            <span className="font-medium text-foreground">
              {owner?.email || tenant.email || "—"}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-muted-foreground">{t("phoneLabel")}: </span>
            <span className="font-medium text-foreground" dir="ltr">
              {owner?.phone || tenant.phone || "—"}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-muted-foreground">
              {t("requestedPlanLabel")}:{" "}
            </span>
            <span className="font-medium text-foreground">
              {initialSubscription?.plan_name || "—"}
            </span>
          </div>
        </div>

        <Tabs defaultValue="approve" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="approve">{t("approveTab")}</TabsTrigger>
            <TabsTrigger
              value="reject"
              disabled={tenant.status === "rejected"}
            >
              {t("rejectTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approve" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("planLabel")}</Label>
                <Select value={resolvedPlanId} onValueChange={handlePlanChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectPlanPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("activationStatusLabel")}</Label>
                <Select
                  value={clinicStatus}
                  onValueChange={(v) =>
                    setClinicStatus(v as ClinicActivationStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("statusActive")}</SelectItem>
                    <SelectItem value="trial">{t("statusTrial")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("billingCycleLabel")}</Label>
                <Select value={billingCycle} onValueChange={handleCycleChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {tPeriods(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("priceLabel")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("discountLabel")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("startDateLabel")}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("endDateLabel")}</Label>
                <Input
                  type="date"
                  value={billingCycle === "lifetime" ? "" : endDate}
                  disabled={billingCycle === "lifetime"}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("graceDaysLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("paymentStatusLabel")}</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(v) =>
                    setPaymentStatus(v as PaymentStatusOption)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">{t("paymentPaid")}</SelectItem>
                    <SelectItem value="pending">
                      {t("paymentPending")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("paymentReferenceLabel")}</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={t("paymentReferencePlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("notesLabel")}</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
              />
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={isPending}
              onClick={handleApprove}
            >
              {isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="me-2 h-4 w-4" />
              )}
              {t("approveButton")}
            </Button>
          </TabsContent>

          <TabsContent value="reject" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>{t("rejectionReasonLabel")}</Label>
              <Textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t("rejectionReasonPlaceholder")}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={isPending}
              onClick={handleReject}
            >
              {isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="me-2 h-4 w-4" />
              )}
              {t("rejectButton")}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
