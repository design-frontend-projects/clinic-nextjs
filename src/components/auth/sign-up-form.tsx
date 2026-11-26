"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy, Loader2 } from "lucide-react";

import { Link } from "@/i18n/routing";
import { requestTenantAccountAction } from "@/app/actions/auth";
import { getPublicPlansAction } from "@/app/actions/public";
import {
  tenantRequestSchema,
  type TenantRequestFormData,
} from "@/types/tenant-request.types";
import type {
  TenantOwnerProfileRecord,
  TenantSubscriptionRecord,
} from "@/types/subscription.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";

type SubmittedRequest = {
  requestRef: string;
  clinicName: string;
  email: string;
  subscription: TenantSubscriptionRecord;
  profile: TenantOwnerProfileRecord;
};

export function SignUpForm({ planId }: { planId?: string }) {
  const t = useTranslations("auth.signUp");
  const tPlans = useTranslations("landing.pricingExtra");
  const tPeriods = useTranslations("appOwner.planEditor.periods");
  const locale = useLocale();

  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedRequest | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => getPublicPlansAction(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TenantRequestFormData>({
    resolver: zodResolver(tenantRequestSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      clinicName: "",
      registrationNumber: "",
      clinicEmail: "",
      clinicPhone: "",
      planId: planId ?? "",
    },
  });

  const selectedPlanId = watch("planId");

  useEffect(() => {
    if (plansLoading || plans.length === 0) return;
    const validIds = plans.map((p) => p.id);
    if (planId && validIds.includes(planId)) {
      if (selectedPlanId !== planId) setValue("planId", planId);
      return;
    }
    if (!validIds.includes(selectedPlanId)) {
      setValue("planId", plans[0].id);
    }
  }, [plansLoading, plans, planId, selectedPlanId, setValue]);

  const onSubmit = async (data: TenantRequestFormData) => {
    setIsLoading(true);
    try {
      const result = await requestTenantAccountAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSubmitted({
        requestRef: result.requestRef,
        clinicName: result.clinicName,
        email: result.email,
        subscription: result.subscription,
        profile: result.profile,
      });
      toast.success(t("requestSubmittedTitle"));
    } catch (error: unknown) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("submitRequestButton"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRef = async () => {
    if (!submitted) return;
    try {
      await navigator.clipboard.writeText(submitted.requestRef);
      setCopied(true);
      toast.success(t("copiedRef"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(submitted.requestRef);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6 text-center py-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-green-soft text-accent-green">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground">
            {t("requestSubmittedTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("requestSubmittedDescription", {
              clinic: submitted.clinicName,
              email: submitted.email,
            })}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("referenceNumberLabel")}
            </span>
            <StatusBadge status="under_review" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-wider text-foreground">
              {submitted.requestRef}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyRef}
              aria-label={t("copyRef")}
            >
              {copied ? (
                <Check className="h-4 w-4 text-accent-green" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <dl className="grid grid-cols-1 gap-1.5 border-t border-border pt-3 text-start text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("ownerLabel")}</dt>
              <dd className="font-medium text-foreground">
                {submitted.profile.full_name || submitted.profile.email}
              </dd>
            </div>
            {submitted.subscription.plan?.name && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("planLabel")}</dt>
                <dd className="font-medium text-foreground">
                  {submitted.subscription.plan.name}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">
                {t("subscriptionStatusLabel")}
              </dt>
              <dd>
                <StatusBadge status={submitted.subscription.status} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default">
            <Link
              href={`/request-status?ref=${encodeURIComponent(submitted.requestRef)}`}
            >
              {t("trackRequestButton")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-in">{t("backToSignIn")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 font-sans">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("ownerSectionTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
            <Input
              id="fullName"
              type="text"
              placeholder={t("fullNamePlaceholder")}
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phoneLabel")}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t("phonePlaceholder")}
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <PasswordInput
              id="password"
              placeholder={t("passwordPlaceholder")}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder={t("confirmPasswordPlaceholder")}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("clinicSectionTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clinicName">{t("clinicNameLabel")}</Label>
            <Input
              id="clinicName"
              type="text"
              placeholder={t("clinicNamePlaceholder")}
              {...register("clinicName")}
            />
            {errors.clinicName && (
              <p className="text-xs text-destructive">
                {errors.clinicName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrationNumber">
              {t("registrationNumberLabel")}
            </Label>
            <Input
              id="registrationNumber"
              type="text"
              placeholder={t("registrationNumberPlaceholder")}
              {...register("registrationNumber")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clinicPhone">{t("clinicPhoneLabel")}</Label>
            <Input
              id="clinicPhone"
              type="tel"
              placeholder={t("clinicPhonePlaceholder")}
              {...register("clinicPhone")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicEmail">{t("clinicEmailLabel")}</Label>
            <Input
              id="clinicEmail"
              type="email"
              placeholder={t("clinicEmailPlaceholder")}
              {...register("clinicEmail")}
            />
            {errors.clinicEmail && (
              <p className="text-xs text-destructive">
                {errors.clinicEmail.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("planSectionTitle")}
        </h3>
        {plansLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("loadingPlans")}</span>
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-destructive">{t("noPlansAvailable")}</p>
        ) : (
          <RadioGroup
            value={selectedPlanId}
            onValueChange={(val) =>
              setValue("planId", val, { shouldValidate: true })
            }
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {plans.map((plan) => {
              const formattedPrice =
                plan.price === 0
                  ? tPlans("free")
                  : new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: plan.currency || "USD",
                      maximumFractionDigits: plan.price % 1 === 0 ? 0 : 2,
                    }).format(plan.price);
              return (
                <Label
                  key={plan.id}
                  htmlFor={`plan-${plan.id}`}
                  className={`flex cursor-pointer flex-col justify-between rounded-lg border p-3.5 transition-colors hover:bg-accent ${
                    selectedPlanId === plan.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} />
                      <span className="font-semibold text-foreground">
                        {plan.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {formattedPrice}
                    </span>
                  </div>
                  <p className="mt-1.5 ps-6 text-xs text-muted-foreground">
                    {tPeriods(plan.billing_period)}
                    {plan.trial_days > 0
                      ? ` · ${tPlans("freeTrial", { days: plan.trial_days })}`
                      : ""}
                  </p>
                </Label>
              );
            })}
          </RadioGroup>
        )}
        {errors.planId && (
          <p className="text-xs text-destructive">{errors.planId.message}</p>
        )}
      </section>

      <Button
        type="submit"
        className="w-full text-sm mt-2"
        disabled={isLoading || plansLoading || plans.length === 0}
      >
        {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        {t("submitRequestButton")}
      </Button>
    </form>
  );
}
