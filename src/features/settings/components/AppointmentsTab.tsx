"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { appointmentsFormSchema, type AppointmentsFormData } from "../domain/dtos";
import type { ReminderRule } from "../domain/models";
import { useModuleSettings, useSaveSettings, valuesByKey } from "../hooks/use-settings";
import { FieldError, TabError, TabLoading } from "./tab-states";
import { ReminderRulesEditor } from "./ReminderRulesEditor";

export function AppointmentsTab() {
  const t = useTranslations("settings");
  const { data, isLoading, error, refetch } = useModuleSettings("appointments");
  const save = useSaveSettings();
  const values = valuesByKey(data);

  const form = useForm<AppointmentsFormData>({
    resolver: zodResolver(appointmentsFormSchema),
    values: {
      slot_duration_minutes: (values["appointments.slot_duration_minutes"] as number) ?? 30,
      min_lead_time_hours: (values["appointments.min_lead_time_hours"] as number) ?? 1,
      max_advance_days: (values["appointments.max_advance_days"] as number) ?? 90,
      cancellation_window_hours: (values["appointments.cancellation_window_hours"] as number) ?? 24,
      allow_online_booking: (values["appointments.allow_online_booking"] as boolean) ?? true,
      reminder_rules: (values["appointments.reminder_rules"] as ReminderRule[]) ?? [],
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={error.message} onRetry={() => refetch()} />;

  const onSubmit = (formData: AppointmentsFormData) => {
    save.mutate([
      { key: "appointments.slot_duration_minutes", value: formData.slot_duration_minutes },
      { key: "appointments.min_lead_time_hours", value: formData.min_lead_time_hours },
      { key: "appointments.max_advance_days", value: formData.max_advance_days },
      { key: "appointments.cancellation_window_hours", value: formData.cancellation_window_hours },
      { key: "appointments.allow_online_booking", value: formData.allow_online_booking },
      { key: "appointments.reminder_rules", value: formData.reminder_rules },
    ]);
  };

  const numberField = (
    name: "slot_duration_minutes" | "min_lead_time_hours" | "max_advance_days" | "cancellation_window_hours",
    label: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type="number" {...form.register(name, { valueAsNumber: true })} />
      <FieldError message={form.formState.errors[name]?.message} />
    </div>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("appointments.title")}</CardTitle>
          <CardDescription>{t("appointments.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {numberField("slot_duration_minutes", t("appointments.slotDuration"))}
          {numberField("min_lead_time_hours", t("appointments.minLeadTime"))}
          {numberField("max_advance_days", t("appointments.maxAdvanceDays"))}
          {numberField("cancellation_window_hours", t("appointments.cancellationWindow"))}
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              checked={form.watch("allow_online_booking")}
              onCheckedChange={(checked) =>
                form.setValue("allow_online_booking", checked === true, { shouldDirty: true })
              }
            />
            <Label>{t("appointments.allowOnlineBooking")}</Label>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("appointments.reminders")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderRulesEditor
            rules={form.watch("reminder_rules")}
            onChange={(rules) => form.setValue("reminder_rules", rules, { shouldDirty: true })}
          />
          <FieldError message={form.formState.errors.reminder_rules?.message} />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
