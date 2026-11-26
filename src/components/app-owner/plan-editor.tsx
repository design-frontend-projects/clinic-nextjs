"use client";

import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import { useRouter } from "@/i18n/routing";
import { upsertSubscriptionPlan } from "@/app/actions/app-owner/plans";
import {
  subscriptionPlanSchema,
  type SubscriptionPlanFormData,
} from "@/types/subscription.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BILLING_PERIODS = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "lifetime",
] as const;
const PLAN_STATUSES = ["active", "inactive", "archived"] as const;

const LIMIT_FIELDS: { name: keyof SubscriptionPlanFormData; labelKey: string }[] = [
  { name: "max_users", labelKey: "maxUsers" },
  { name: "max_doctors", labelKey: "maxDoctors" },
  { name: "max_branches", labelKey: "maxBranches" },
  { name: "max_patients", labelKey: "maxPatients" },
  { name: "max_appointments", labelKey: "maxAppointments" },
  { name: "max_storage_mb", labelKey: "maxStorageMb" },
  { name: "api_limits", labelKey: "apiLimits" },
];

interface PlanEditorProps {
  plan?: Partial<SubscriptionPlanFormData> & { id?: string };
}

function safeFormatPrice(amountRaw: unknown, currencyRaw: unknown, locale: string) {
  const amount = Number(amountRaw);
  const numeric = Number.isFinite(amount) ? amount : 0;
  const currency =
    typeof currencyRaw === "string" && currencyRaw.trim().length === 3
      ? currencyRaw.trim().toUpperCase()
      : "USD";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

export function PlanEditor({ plan }: PlanEditorProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("appOwner.planEditor");
  const tPlans = useTranslations("appOwner.plans");
  const [isPending, startTransition] = useTransition();

  const form = useForm<SubscriptionPlanFormData>({
    resolver: zodResolver(subscriptionPlanSchema),
    defaultValues: {
      id: plan?.id,
      name: plan?.name ?? "",
      description: plan?.description ?? "",
      billing_period: plan?.billing_period ?? "monthly",
      trial_days: plan?.trial_days ?? 14,
      price: plan?.price ?? 0,
      currency: plan?.currency ?? "USD",
      max_users: plan?.max_users ?? "",
      max_doctors: plan?.max_doctors ?? "",
      max_branches: plan?.max_branches ?? "",
      max_patients: plan?.max_patients ?? "",
      max_appointments: plan?.max_appointments ?? "",
      max_storage_mb: plan?.max_storage_mb ?? "",
      api_limits: plan?.api_limits ?? "",
      status: plan?.status ?? "active",
      display_order: plan?.display_order ?? 0,
      public_notes: plan?.public_notes ?? "",
      internal_notes: plan?.internal_notes ?? "",
      features: plan?.features ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "features",
  });

  const watched = form.watch();

  const onSubmit = (data: SubscriptionPlanFormData) => {
    startTransition(async () => {
      const result = await upsertSubscriptionPlan(data);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(plan?.id ? t("toastUpdated") : t("toastCreated"));
      router.push("/app-owner/plans");
      router.refresh();
    });
  };

  const previewFeatures = (watched.features ?? []).filter(
    (f) => f.is_enabled && f.feature_name?.trim(),
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* Left: Form Cards */}
        <div className="space-y-6 xl:col-span-8">
          <Card elevated>
            <CardHeader>
              <CardTitle>{t("title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("nameLabel")}</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder={t("namePlaceholder")}
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("statusLabel")}</Label>
                  <Select
                    value={watched.status}
                    onValueChange={(v) =>
                      form.setValue(
                        "status",
                        v as SubscriptionPlanFormData["status"],
                        { shouldDirty: true },
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`statuses.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("descriptionLabel")}</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder={t("descriptionPlaceholder")}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="price">{t("priceLabel")}</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    {...form.register("price")}
                  />
                  {form.formState.errors.price && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.price.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t("currencyLabel")}</Label>
                  <Input id="currency" {...form.register("currency")} />
                </div>
                <div className="space-y-2 sm:col-span-2 md:col-span-1">
                  <Label>{t("billingPeriodLabel")}</Label>
                  <Select
                    value={watched.billing_period}
                    onValueChange={(v) =>
                      form.setValue(
                        "billing_period",
                        v as SubscriptionPlanFormData["billing_period"],
                        { shouldDirty: true },
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_PERIODS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`periods.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trial_days">{t("trialDaysLabel")}</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    {...form.register("trial_days")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_order">
                    {t("displayOrderLabel")}
                  </Label>
                  <Input
                    id="display_order"
                    type="number"
                    {...form.register("display_order")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevated>
            <CardHeader>
              <CardTitle>{t("limitsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {LIMIT_FIELDS.map((f) => (
                  <div key={f.name} className="space-y-2">
                    <Label htmlFor={f.name}>{t(`limits.${f.labelKey}`)}</Label>
                    <Input
                      id={f.name}
                      type="number"
                      placeholder={t("unlimitedPlaceholder")}
                      {...form.register(f.name)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card elevated>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>{t("featuresTitle")}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ feature_name: "", is_enabled: true })}
              >
                <Plus className="me-2 h-4 w-4" />
                {t("addFeature")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("noFeatures")}
                </p>
              )}
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-2.5 rounded-[var(--radius-button)] border border-hairline-soft bg-canvas-soft/60 p-2.5 sm:flex-row sm:items-center dark:border-hairline dark:bg-surface-elevated/40"
                >
                  <Input
                    placeholder={t("featureNamePlaceholder")}
                    className="flex-1 bg-surface"
                    {...form.register(`features.${index}.feature_name`)}
                  />
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <label className="flex shrink-0 items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(
                          watched.features?.[index]?.is_enabled ?? true,
                        )}
                        onCheckedChange={(c) =>
                          form.setValue(
                            `features.${index}.is_enabled`,
                            Boolean(c),
                            { shouldDirty: true },
                          )
                        }
                      />
                      {t("enabled")}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      aria-label={t("addFeature")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/app-owner/plans")}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {plan?.id ? t("savePlan") : t("createPlan")}
            </Button>
          </div>
        </div>

        {/* Right: Sticky Live Plan Preview */}
        <div className="xl:col-span-4 xl:sticky xl:top-20">
          <Card elevated cornerAccent>
            <CardHeader className="border-b border-hairline-soft pb-4 dark:border-hairline">
              <p className="text-eyebrow uppercase tracking-wider text-primary">
                {tPlans("previewTitle")}
              </p>
              <CardDescription className="text-xs">
                {tPlans("previewSubtitle")}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-lg font-bold text-foreground">
                    {watched.name?.trim() || t("namePlaceholder")}
                  </h3>
                  {watched.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {watched.description}
                    </p>
                  )}
                </div>
                <StatusBadge
                  status={watched.status || "active"}
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline-soft pb-4 dark:border-hairline">
                <div>
                  <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {safeFormatPrice(watched.price, watched.currency, locale)}
                  </span>
                  <span className="ms-1.5 text-xs text-muted-foreground">
                    / {t(`periods.${watched.billing_period || "monthly"}`)}
                  </span>
                </div>
                {Number(watched.trial_days || 0) > 0 && (
                  <Badge variant="outline" className="text-[11px]">
                    {tPlans("trialDaysBadge", {
                      days: Number(watched.trial_days || 0),
                    })}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-button)] border border-hairline-soft bg-canvas-soft/60 p-2.5 text-center text-xs dark:border-hairline dark:bg-surface-elevated/50">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    {tPlans("usersLimit")}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {watched.max_users !== "" && watched.max_users != null
                      ? String(watched.max_users)
                      : tPlans("unlimited")}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    {tPlans("doctorsLimit")}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {watched.max_doctors !== "" && watched.max_doctors != null
                      ? String(watched.max_doctors)
                      : tPlans("unlimited")}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    {tPlans("branchesLimit")}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {watched.max_branches !== "" && watched.max_branches != null
                      ? String(watched.max_branches)
                      : tPlans("unlimited")}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {previewFeatures.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    {tPlans("noFeaturesPreview")}
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {previewFeatures.map((feat, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-foreground"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0 text-accent-green" />
                        <span className="truncate">{feat.feature_name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
