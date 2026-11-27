"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";

import { useRouter } from "@/i18n/routing";
import { upsertSpecialty } from "@/app/actions/app-owner/specialties";
import { DIAGRAM_OPTIONS } from "@/lib/body-chart/registry";
import { DiagramMiniPreview } from "@/components/body-chart/diagram-mini-preview";
import {
  specialtySchema,
  type SpecialtyFormData,
} from "@/types/specialty.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpecialtyEditorProps {
  specialty?: Partial<SpecialtyFormData> & { id?: string };
}

export function SpecialtyEditor({ specialty }: SpecialtyEditorProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("appOwner.specialtyEditor");
  const tSpecialties = useTranslations("appOwner.specialties");
  const [isPending, startTransition] = useTransition();

  const form = useForm<SpecialtyFormData>({
    resolver: zodResolver(specialtySchema),
    defaultValues: {
      id: specialty?.id,
      name: specialty?.name ?? "",
      name_ar: specialty?.name_ar ?? "",
      description: specialty?.description ?? "",
      diagram_key: specialty?.diagram_key ?? "general_body",
      is_active: specialty?.is_active ?? true,
      display_order: specialty?.display_order ?? 0,
    },
  });

  const isActive = form.watch("is_active");
  const diagramKey = form.watch("diagram_key") ?? "general_body";

  const onSubmit = (data: SpecialtyFormData) => {
    startTransition(async () => {
      const result = await upsertSpecialty(data);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(specialty?.id ? t("toastUpdated") : t("toastCreated"));
      router.push("/app-owner/specialties");
      router.refresh();
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card elevated cornerAccent>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <span>{t("title")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameEnLabel")}</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder={t("nameEnPlaceholder")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_ar">{t("nameArLabel")}</Label>
              <Input
                id="name_ar"
                dir="rtl"
                {...form.register("name_ar")}
                placeholder={t("nameArPlaceholder")}
              />
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

          <div className="grid gap-4 md:grid-cols-2 items-start">
            <div className="space-y-2">
              <Label htmlFor="diagram_key">{t("diagramTemplateLabel")}</Label>
              <Select
                value={diagramKey}
                onValueChange={(val) =>
                  form.setValue(
                    "diagram_key",
                    val as SpecialtyFormData["diagram_key"],
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger id="diagram_key">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAGRAM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {locale === "ar" ? opt.nameAr : opt.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("diagramTemplateDesc")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("diagramPreviewTitle")}
              </Label>
              <DiagramMiniPreview diagramKey={diagramKey} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_order">{t("displayOrderLabel")}</Label>
              <Input
                id="display_order"
                type="number"
                {...form.register("display_order")}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-button)] border border-hairline bg-canvas-soft/60 px-3.5 py-2.5 dark:bg-surface-elevated/40">
              <div className="space-y-0.5">
                <Label htmlFor="specialty_active" className="cursor-pointer">
                  {t("activeLabel")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tSpecialties("activeToggleDesc")}
                </p>
              </div>
              <Switch
                id="specialty_active"
                checked={isActive}
                onCheckedChange={(checked) =>
                  form.setValue("is_active", checked, { shouldDirty: true })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/app-owner/specialties")}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {specialty?.id ? t("saveSpecialty") : t("createSpecialty")}
        </Button>
      </div>
    </form>
  );
}
