"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { upsertMedication } from "@/app/actions/app-owner/medications";
import {
  medicationSchema,
  type MedicationFormData,
  type ClinicOption,
} from "@/types/medication.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface MedicationEditorProps {
  clinics: ClinicOption[];
  medication?: Partial<MedicationFormData> & { id?: string };
  defaultClinicId?: string;
}

export function MedicationEditor({
  clinics,
  medication,
  defaultClinicId,
}: MedicationEditorProps) {
  const router = useRouter();
  const t = useTranslations("appOwner.medicationEditor");
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(medication?.id);

  const form = useForm<MedicationFormData>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      id: medication?.id,
      clinic_id: medication?.clinic_id ?? defaultClinicId ?? clinics[0]?.id ?? "",
      generic_name: medication?.generic_name ?? "",
      brand_name: medication?.brand_name ?? "",
      strength: medication?.strength ?? "",
      form: medication?.form ?? "",
      route: medication?.route ?? "",
      manufacturer: medication?.manufacturer ?? "",
      barcode: medication?.barcode ?? "",
      code: medication?.code ?? "",
      code_system: medication?.code_system ?? "",
      price: medication?.price ?? null,
      is_active: medication?.is_active ?? true,
    },
  });

  const clinicId = form.watch("clinic_id");

  const onSubmit = (data: MedicationFormData) => {
    startTransition(async () => {
      const result = await upsertMedication(data);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? t("toastUpdated") : t("toastCreated"));
      router.push(`/app-owner/medications?clinic=${data.clinic_id}`);
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
          <div className="space-y-2">
            <Label htmlFor="clinic_id">{t("clinicLabel")}</Label>
            <Select
              value={clinicId}
              onValueChange={(val) =>
                form.setValue("clinic_id", val, { shouldValidate: true })
              }
              disabled={isEditing}
            >
              <SelectTrigger id="clinic_id">
                <SelectValue placeholder={t("clinicPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {clinics.map((clinic) => (
                  <SelectItem key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.clinic_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.clinic_id.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="generic_name">{t("genericNameLabel")}</Label>
              <Input
                id="generic_name"
                {...form.register("generic_name")}
                placeholder={t("genericNamePlaceholder")}
              />
              {form.formState.errors.generic_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.generic_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_name">{t("brandNameLabel")}</Label>
              <Input
                id="brand_name"
                {...form.register("brand_name")}
                placeholder={t("brandNamePlaceholder")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="strength">{t("strengthLabel")}</Label>
              <Input id="strength" {...form.register("strength")} placeholder={t("strengthPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form">{t("formLabel")}</Label>
              <Input id="form" {...form.register("form")} placeholder={t("formPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="route">{t("routeLabel")}</Label>
              <Input id="route" {...form.register("route")} placeholder={t("routePlaceholder")} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">{t("manufacturerLabel")}</Label>
              <Input id="manufacturer" {...form.register("manufacturer")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">{t("priceLabel")}</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                {...form.register("price")}
                placeholder="0.00"
              />
              {form.formState.errors.price && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.price.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="barcode">{t("barcodeLabel")}</Label>
              <Input id="barcode" {...form.register("barcode")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">{t("codeLabel")}</Label>
              <Input id="code" {...form.register("code")} placeholder="RxNorm / ATC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code_system">{t("codeSystemLabel")}</Label>
              <Input
                id="code_system"
                {...form.register("code_system")}
                placeholder="RxNorm"
              />
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                defaultChecked={form.getValues("is_active") ?? true}
                onCheckedChange={(c) => form.setValue("is_active", Boolean(c))}
              />
              {t("activeLabel")}
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(`/app-owner/medications?clinic=${clinicId}`)
          }
        >
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {isEditing ? t("saveMedication") : t("createMedication")}
        </Button>
      </div>
    </form>
  );
}
