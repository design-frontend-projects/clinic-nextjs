"use client";

import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

import { upsertSubscriptionPlan } from "@/app/actions/app-owner/plans";
import {
  subscriptionPlanSchema,
  type SubscriptionPlanFormData,
} from "@/types/subscription.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

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

export function PlanEditor({ plan }: PlanEditorProps) {
  const router = useRouter();
  const t = useTranslations("appOwner.planEditor");
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" {...form.register("name")} placeholder={t("namePlaceholder")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("statusLabel")}</Label>
              <Select
                defaultValue={form.getValues("status")}
                onValueChange={(v) =>
                  form.setValue("status", v as SubscriptionPlanFormData["status"])
                }
              >
                <SelectTrigger>
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

          <div className="grid gap-4 md:grid-cols-3">
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
            <div className="space-y-2">
              <Label>{t("billingPeriodLabel")}</Label>
              <Select
                defaultValue={form.getValues("billing_period")}
                onValueChange={(v) =>
                  form.setValue(
                    "billing_period",
                    v as SubscriptionPlanFormData["billing_period"],
                  )
                }
              >
                <SelectTrigger>
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
              <Input id="trial_days" type="number" {...form.register("trial_days")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">{t("displayOrderLabel")}</Label>
              <Input
                id="display_order"
                type="number"
                {...form.register("display_order")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("limitsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
            <p className="text-sm text-muted-foreground">{t("noFeatures")}</p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-3">
              <Input
                placeholder={t("featureNamePlaceholder")}
                {...form.register(`features.${index}.feature_name`)}
              />
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <Checkbox
                  defaultChecked={form.getValues(`features.${index}.is_enabled`)}
                  onCheckedChange={(c) =>
                    form.setValue(`features.${index}.is_enabled`, Boolean(c))
                  }
                />
                {t("enabled")}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
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
    </form>
  );
}
