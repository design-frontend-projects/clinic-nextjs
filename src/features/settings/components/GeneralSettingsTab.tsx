"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generalSettingsFormSchema, type GeneralSettingsFormData } from "../domain/dtos";
import { useModuleSettings, useSaveSettings, valuesByKey } from "../hooks/use-settings";
import { FieldError, TabError, TabLoading } from "./tab-states";

export function GeneralSettingsTab() {
  const t = useTranslations("settings");
  const { data, isLoading, error, refetch } = useModuleSettings("organization");
  const save = useSaveSettings();
  const values = valuesByKey(data);

  const form = useForm<GeneralSettingsFormData>({
    resolver: zodResolver(generalSettingsFormSchema),
    values: {
      display_name: (values["organization.display_name"] as string) ?? "",
      legal_name: (values["organization.legal_name"] as string) ?? "",
      tax_number: (values["organization.tax_number"] as string) ?? "",
      address: (values["organization.address"] as string) ?? "",
      contact_email: (values["organization.contact_email"] as string) ?? "",
      contact_phone: (values["organization.contact_phone"] as string) ?? "",
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={error.message} onRetry={() => refetch()} />;

  const onSubmit = (formData: GeneralSettingsFormData) => {
    save.mutate([
      { key: "organization.display_name", value: formData.display_name },
      { key: "organization.legal_name", value: formData.legal_name },
      { key: "organization.tax_number", value: formData.tax_number },
      { key: "organization.address", value: formData.address },
      { key: "organization.contact_email", value: formData.contact_email },
      { key: "organization.contact_phone", value: formData.contact_phone },
    ]);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t("general.title")}</CardTitle>
          <CardDescription>{t("general.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="display_name">{t("general.displayName")}</Label>
            <Input id="display_name" {...form.register("display_name")} />
            <FieldError message={form.formState.errors.display_name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal_name">{t("general.legalName")}</Label>
            <Input id="legal_name" {...form.register("legal_name")} />
            <FieldError message={form.formState.errors.legal_name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_number">{t("general.taxNumber")}</Label>
            <Input id="tax_number" {...form.register("tax_number")} />
            <FieldError message={form.formState.errors.tax_number?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">{t("general.contactPhone")}</Label>
            <Input id="contact_phone" {...form.register("contact_phone")} />
            <FieldError message={form.formState.errors.contact_phone?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">{t("general.contactEmail")}</Label>
            <Input id="contact_email" type="email" {...form.register("contact_email")} />
            <FieldError message={form.formState.errors.contact_email?.message} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">{t("general.address")}</Label>
            <Textarea id="address" rows={2} {...form.register("address")} />
            <FieldError message={form.formState.errors.address?.message} />
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
