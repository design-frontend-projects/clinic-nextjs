"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { subscriptionSchema, type SubscriptionFormData } from "@/types/onboarding.types";
import { getPublicPlansAction } from "@/app/actions/public";
import { useTranslations, useLocale } from "next-intl";

type SubscriptionSetupStepProps = {
  defaultValues?: Partial<SubscriptionFormData>;
  onSubmit: (data: SubscriptionFormData) => void;
  loading?: boolean;
};

type PlanOption = {
  id: string;
  name: string;
  price: string;
  features: string[];
};

export function SubscriptionSetupStep({
  defaultValues,
  onSubmit,
  loading,
}: SubscriptionSetupStepProps) {
  const t = useTranslations("plans");
  const tx = useTranslations("landing.pricingExtra");
  const locale = useLocale();

  const { data: dbPlans, isLoading: plansLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => getPublicPlansAction(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      plan_id: defaultValues?.plan_id ?? "basic",
    },
  });

  const selectedPlanId = watch("plan_id");

  // Fallback keeps onboarding working when no plans exist in the DB yet
  // (legacy ids "basic"/"pro" are handled by saveClinicStep).
  const fallbackPlans: PlanOption[] = [
    {
      id: "basic",
      name: t("basic"),
      price: t("basicPrice"),
      features: t.raw("basicFeatures") as string[],
    },
    {
      id: "pro",
      name: t("pro"),
      price: t("proPrice"),
      features: t.raw("proFeatures") as string[],
    },
  ];

  const plans: PlanOption[] =
    dbPlans && dbPlans.length > 0
      ? dbPlans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price:
            plan.price === 0
              ? tx("free")
              : new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: plan.currency || "USD",
                  maximumFractionDigits: plan.price % 1 === 0 ? 0 : 2,
                }).format(plan.price),
          features: [
            ...plan.features.filter((f) => f.is_enabled).map((f) => f.feature_name),
            ...(plan.trial_days > 0 ? [tx("freeTrial", { days: plan.trial_days })] : []),
          ],
        }))
      : fallbackPlans;

  // Reconcile the selection with the loaded plan list: keep a valid persisted
  // or URL-provided id, otherwise fall back to the first available plan.
  useEffect(() => {
    if (plansLoading) return;
    const validIds = plans.map((p) => p.id);
    if (!validIds.includes(selectedPlanId)) {
      setValue("plan_id", validIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansLoading, dbPlans, selectedPlanId]);

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <RadioGroup
          value={selectedPlanId}
          onValueChange={(val: string) => setValue("plan_id", val)}
          className="grid gap-4"
        >
          {plans.map((plan) => (
            <Label
              key={plan.id}
              className={`flex cursor-pointer flex-col rounded-lg border p-4 hover:bg-accent ${
                selectedPlanId === plan.id ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={plan.id} id={plan.id} />
                  <span className="font-semibold text-foreground">{plan.name}</span>
                </div>
                <span className="font-bold text-primary">{plan.price}</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground ms-7">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-accent-green" />
                    {feature}
                  </li>
                ))}
              </ul>
            </Label>
          ))}
        </RadioGroup>
        {errors.plan_id && (
          <p className="text-xs text-destructive">{errors.plan_id.message}</p>
        )}
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="me-2 h-4 w-4 rtl:rotate-180" />
          )}
          {t("continueToSetup")}
        </Button>
      </div>
    </form>
  );
}
