"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { upsertSpecialty } from "@/app/actions/app-owner/specialties";
import {
  specialtySchema,
  type SpecialtyFormData,
} from "@/types/specialty.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface SpecialtyEditorProps {
  specialty?: Partial<SpecialtyFormData> & { id?: string };
}

export function SpecialtyEditor({ specialty }: SpecialtyEditorProps) {
  const router = useRouter();
  const t = useTranslations("appOwner.specialtyEditor");
  const [isPending, startTransition] = useTransition();

  const form = useForm<SpecialtyFormData>({
    resolver: zodResolver(specialtySchema),
    defaultValues: {
      id: specialty?.id,
      name: specialty?.name ?? "",
      name_ar: specialty?.name_ar ?? "",
      description: specialty?.description ?? "",
      is_active: specialty?.is_active ?? true,
      display_order: specialty?.display_order ?? 0,
    },
  });

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
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_order">{t("displayOrderLabel")}</Label>
              <Input
                id="display_order"
                type="number"
                {...form.register("display_order")}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  defaultChecked={form.getValues("is_active")}
                  onCheckedChange={(c) =>
                    form.setValue("is_active", Boolean(c))
                  }
                />
                {t("activeLabel")}
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
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
