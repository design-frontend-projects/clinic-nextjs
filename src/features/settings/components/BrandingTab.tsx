"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brandingFormSchema, type BrandingFormData } from "../domain/dtos";
import { useModuleSettings, useSaveSettings, valuesByKey } from "../hooks/use-settings";
import { FieldError, TabError, TabLoading } from "./tab-states";

function ColorField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="h-9 w-10 cursor-pointer rounded-md border border-input bg-transparent p-1"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" />
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function BrandingTab() {
  const t = useTranslations("settings");
  const { data, isLoading, error, refetch } = useModuleSettings("branding");
  const save = useSaveSettings();
  const values = valuesByKey(data);

  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingFormSchema),
    values: {
      logo_url: (values["branding.logo_url"] as string) ?? "",
      primary_color: (values["branding.primary_color"] as string) ?? "#0ea5e9",
      secondary_color: (values["branding.secondary_color"] as string) ?? "#64748b",
      invoice_footer_text: (values["branding.invoice_footer_text"] as string) ?? "",
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={error.message} onRetry={() => refetch()} />;

  const onSubmit = (formData: BrandingFormData) => {
    save.mutate([
      { key: "branding.logo_url", value: formData.logo_url },
      { key: "branding.primary_color", value: formData.primary_color },
      { key: "branding.secondary_color", value: formData.secondary_color },
      { key: "branding.invoice_footer_text", value: formData.invoice_footer_text },
    ]);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t("branding.title")}</CardTitle>
          <CardDescription>{t("branding.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="logo_url">{t("branding.logoUrl")}</Label>
            <Input id="logo_url" placeholder="https://..." {...form.register("logo_url")} />
            <FieldError message={form.formState.errors.logo_url?.message} />
          </div>
          <ColorField
            id="primary_color"
            label={t("branding.primaryColor")}
            value={form.watch("primary_color")}
            onChange={(value) => form.setValue("primary_color", value, { shouldDirty: true })}
            error={form.formState.errors.primary_color?.message}
          />
          <ColorField
            id="secondary_color"
            label={t("branding.secondaryColor")}
            value={form.watch("secondary_color")}
            onChange={(value) => form.setValue("secondary_color", value, { shouldDirty: true })}
            error={form.formState.errors.secondary_color?.message}
          />
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="invoice_footer_text">{t("branding.invoiceFooter")}</Label>
            <Textarea id="invoice_footer_text" rows={2} {...form.register("invoice_footer_text")} />
            <FieldError message={form.formState.errors.invoice_footer_text?.message} />
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
