"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Loader2 } from "lucide-react";

import {
  suspendTenant,
  activateTenant,
  blockUser,
  unblockUser,
  emailUser,
  assignTenantPlan,
} from "@/app/actions/app-owner/tenants";
import { getSubscriptionPlans } from "@/app/actions/app-owner/plans";
import { subscriptionWindow } from "@/lib/subscription-provisioning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

const BILLING_CYCLES = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "lifetime",
] as const;
const SUB_STATUSES = [
  "active",
  "past_due",
  "suspended",
  "cancelled",
  "pending_approval",
] as const;
const PAYMENT_STATUSES = ["pending", "paid", "refunded"] as const;

type BillingCycle = (typeof BILLING_CYCLES)[number];
type SubStatus = (typeof SUB_STATUSES)[number];
type PaymentStatusOption = (typeof PAYMENT_STATUSES)[number];

interface TenantOwner {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
}

interface TenantSubscriptionSnapshot {
  plan_id: string;
  billing_cycle: string;
  price: number;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  start_date: string;
  end_date: string | null;
  grace_period_days: number;
}

interface TenantRowActionsProps {
  tenant: { id: string; name: string; status: string };
  owner: TenantOwner | null;
  subscription?: TenantSubscriptionSnapshot | null;
}

function formatDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function autoEndDateForCycle(startStr: string, cycle: BillingCycle): string {
  if (cycle === "lifetime" || !startStr) return "";
  const d = new Date(`${startStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const { endDate } = subscriptionWindow(cycle, d);
  return endDate ? endDate.toISOString().slice(0, 10) : "";
}

export function TenantRowActions({
  tenant,
  owner,
  subscription,
}: TenantRowActionsProps) {
  const router = useRouter();
  const t = useTranslations("appOwner.tenantActions");
  const tPeriods = useTranslations("appOwner.planEditor.periods");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initialCycle = (
    BILLING_CYCLES.includes(subscription?.billing_cycle as BillingCycle)
      ? subscription?.billing_cycle
      : "monthly"
  ) as BillingCycle;
  const initialStatus = (
    SUB_STATUSES.includes(subscription?.status as SubStatus)
      ? subscription?.status
      : "active"
  ) as SubStatus;
  const initialPayment = (
    PAYMENT_STATUSES.includes(subscription?.payment_status as PaymentStatusOption)
      ? subscription?.payment_status
      : "paid"
  ) as PaymentStatusOption;

  const [planId, setPlanId] = useState<string>(subscription?.plan_id ?? "");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const [price, setPrice] = useState<string>(
    subscription ? String(subscription.price) : "",
  );
  const [subStatus, setSubStatus] = useState<SubStatus>(initialStatus);
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatusOption>(initialPayment);
  const [paymentReference, setPaymentReference] = useState<string>(
    subscription?.payment_reference ?? "",
  );
  const [startDate, setStartDate] = useState<string>(
    formatDateInput(subscription?.start_date) ||
      new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState<string>(
    formatDateInput(subscription?.end_date) ||
      autoEndDateForCycle(new Date().toISOString().slice(0, 10), initialCycle),
  );
  const [gracePeriodDays, setGracePeriodDays] = useState<string>(
    String(subscription?.grace_period_days ?? 7),
  );

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => getSubscriptionPlans(),
    enabled: open,
  });

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toastDone"));
      router.refresh();
    });
  };

  const handleAssignPlan = () => {
    if (!planId) {
      toast.error(t("toastSelectPlan"));
      return;
    }
    run(() =>
      assignTenantPlan({
        tenant_id: tenant.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        price: Number(price || 0),
        status: subStatus,
        currency: "USD",
        start_date: startDate || undefined,
        end_date: billingCycle === "lifetime" ? null : endDate || null,
        payment_status: paymentStatus,
        payment_reference: paymentReference.trim() || null,
        grace_period_days: Number(gracePeriodDays || 7),
      }),
    );
  };

  const isSuspended = tenant.status === "suspended";
  const isOwnerBlocked = owner?.status === "blocked";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{tenant.name}</SheetTitle>
          <SheetDescription>
            {t("sheetDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("tenantStatusTitle")}</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {t("currentStatus", { status: tenant.status })}
            </p>
            {isSuspended ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => activateTenant(tenant.id))}
              >
                {t("activateTenant")}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => run(() => suspendTenant(tenant.id))}
              >
                {t("suspendTenant")}
              </Button>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("ownerTitle")}</h3>
            {owner ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {owner.full_name || "—"} ({owner.email || t("noEmail")}) —{" "}
                  <span className="capitalize">{owner.status}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {isOwnerBlocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => unblockUser(owner.id))}
                    >
                      {t("unblock")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => blockUser(owner.id))}
                    >
                      {t("block")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || !owner.email}
                    onClick={() => run(() => emailUser(owner.id))}
                  >
                    {t("emailSetPasswordLink")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("noOwnerProfile")}
              </p>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("assignPlanTitle")}</h3>
            <div className="space-y-2">
              <Label>{t("planLabel")}</Label>
              <Select value={planId} onValueChange={setPlanId}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("billingCycleLabel")}</Label>
                <Select
                  value={billingCycle}
                  onValueChange={(v) => {
                    const next = v as BillingCycle;
                    setBillingCycle(next);
                    setEndDate(autoEndDateForCycle(startDate, next));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {tPeriods(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("priceLabel")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("startDateLabel")}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStartDate(next);
                    setEndDate(autoEndDateForCycle(next, billingCycle));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("endDateLabel")}</Label>
                <Input
                  type="date"
                  value={billingCycle === "lifetime" ? "" : endDate}
                  disabled={billingCycle === "lifetime"}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
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
                    {PAYMENT_STATUSES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`paymentStatuses.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>{t("paymentReferenceLabel")}</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={t("paymentReferencePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("statusLabel")}</Label>
              <Select
                value={subStatus}
                onValueChange={(v) => setSubStatus(v as SubStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUB_STATUSES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`subStatuses.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={handleAssignPlan}
            >
              {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("assignPlanButton")}
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
