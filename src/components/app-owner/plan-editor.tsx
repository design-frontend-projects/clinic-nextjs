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

const BILLING_PERIODS = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "lifetime",
] as const;
const PLAN_STATUSES = ["active", "inactive", "archived"] as const;

const LIMIT_FIELDS: { name: keyof SubscriptionPlanFormData; label: string }[] = [
  { name: "max_users", label: "Max Users" },
  { name: "max_doctors", label: "Max Doctors" },
  { name: "max_branches", label: "Max Branches" },
  { name: "max_patients", label: "Max Patients" },
  { name: "max_appointments", label: "Max Appointments" },
  { name: "max_storage_mb", label: "Max Storage (MB)" },
  { name: "api_limits", label: "API Limit" },
];

interface PlanEditorProps {
  plan?: Partial<SubscriptionPlanFormData> & { id?: string };
}

export function PlanEditor({ plan }: PlanEditorProps) {
  const router = useRouter();
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
      toast.success(plan?.id ? "Plan updated." : "Plan created.");
      router.push("/app-owner/plans");
      router.refresh();
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...form.register("name")} placeholder="Pro" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
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
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Short description of the plan"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price">Price *</Label>
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
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" {...form.register("currency")} />
            </div>
            <div className="space-y-2">
              <Label>Billing Period</Label>
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
                    <SelectItem key={p} value={p} className="capitalize">
                      {p.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trial_days">Trial Days</Label>
              <Input id="trial_days" type="number" {...form.register("trial_days")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
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
          <CardTitle>Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {LIMIT_FIELDS.map((f) => (
              <div key={f.name} className="space-y-2">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input
                  id={f.name}
                  type="number"
                  placeholder="Unlimited"
                  {...form.register(f.name)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Features</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ feature_name: "", is_enabled: true })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Feature
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">No features added.</p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-3">
              <Input
                placeholder="Feature name"
                {...form.register(`features.${index}.feature_name`)}
              />
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <Checkbox
                  defaultChecked={form.getValues(`features.${index}.is_enabled`)}
                  onCheckedChange={(c) =>
                    form.setValue(`features.${index}.is_enabled`, Boolean(c))
                  }
                />
                Enabled
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
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {plan?.id ? "Save Plan" : "Create Plan"}
        </Button>
      </div>
    </form>
  );
}
