"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localizationFormSchema, type LocalizationFormData } from "../domain/dtos";
import { useModuleSettings, useSaveSettings, valuesByKey } from "../hooks/use-settings";
import { FieldError, TabError, TabLoading } from "./tab-states";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

export function LocalizationTab() {
  const t = useTranslations("settings");
  const { data, isLoading, error, refetch } = useModuleSettings("localization");
  const save = useSaveSettings();
  const values = valuesByKey(data);

  const form = useForm<LocalizationFormData>({
    resolver: zodResolver(localizationFormSchema),
    values: {
      default_language: (values["localization.default_language"] as "en" | "ar") ?? "en",
      timezone: (values["localization.timezone"] as string) ?? "UTC",
      currency: (values["localization.currency"] as string) ?? "USD",
      date_format: (values["localization.date_format"] as LocalizationFormData["date_format"]) ?? "DD/MM/YYYY",
      time_format: (values["localization.time_format"] as "12h" | "24h") ?? "12h",
      first_day_of_week:
        (values["localization.first_day_of_week"] as LocalizationFormData["first_day_of_week"]) ?? "sunday",
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={error.message} onRetry={() => refetch()} />;

  const onSubmit = (formData: LocalizationFormData) => {
    save.mutate([
      { key: "localization.default_language", value: formData.default_language },
      { key: "localization.timezone", value: formData.timezone },
      { key: "localization.currency", value: formData.currency },
      { key: "localization.date_format", value: formData.date_format },
      { key: "localization.time_format", value: formData.time_format },
      { key: "localization.first_day_of_week", value: formData.first_day_of_week },
    ]);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t("localization.title")}</CardTitle>
          <CardDescription>{t("localization.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("localization.language")}</Label>
            <Select
              value={form.watch("default_language")}
              onValueChange={(value) => form.setValue("default_language", value as "en" | "ar", { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("localization.languages.en")}</SelectItem>
                <SelectItem value="ar">{t("localization.languages.ar")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">{t("localization.timezone")}</Label>
            <Input id="timezone" placeholder="Africa/Cairo" {...form.register("timezone")} />
            <FieldError message={form.formState.errors.timezone?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">{t("localization.currency")}</Label>
            <Input id="currency" placeholder="USD" maxLength={3} {...form.register("currency")} />
            <FieldError message={form.formState.errors.currency?.message} />
          </div>
          <div className="space-y-2">
            <Label>{t("localization.dateFormat")}</Label>
            <Select
              value={form.watch("date_format")}
              onValueChange={(value) =>
                form.setValue("date_format", value as LocalizationFormData["date_format"], { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("localization.timeFormat")}</Label>
            <Select
              value={form.watch("time_format")}
              onValueChange={(value) => form.setValue("time_format", value as "12h" | "24h", { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">{t("localization.timeFormats.h12")}</SelectItem>
                <SelectItem value="24h">{t("localization.timeFormats.h24")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("localization.firstDayOfWeek")}</Label>
            <Select
              value={form.watch("first_day_of_week")}
              onValueChange={(value) =>
                form.setValue("first_day_of_week", value as LocalizationFormData["first_day_of_week"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saturday">{t("days.saturday")}</SelectItem>
                <SelectItem value="sunday">{t("days.sunday")}</SelectItem>
                <SelectItem value="monday">{t("days.monday")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
