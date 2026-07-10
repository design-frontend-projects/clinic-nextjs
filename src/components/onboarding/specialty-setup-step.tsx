"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getActiveSpecialties } from "@/app/actions/specialties";
import type { ActiveSpecialty } from "@/types/specialty.types";

type SpecialtySetupStepProps = {
  defaultValues?: string[];
  onSubmit: (specialtyIds: string[]) => void;
  onBack: () => void;
  loading?: boolean;
};

export function SpecialtySetupStep({
  defaultValues,
  onSubmit,
  onBack,
  loading,
}: SpecialtySetupStepProps) {
  const t = useTranslations("auth.onboarding");
  const locale = useLocale();
  const [specialties, setSpecialties] = useState<ActiveSpecialty[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultValues ?? []),
  );
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let active = true;
    getActiveSpecialties()
      .then((data) => {
        if (active) setSpecialties(data);
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const labelFor = (s: ActiveSpecialty) =>
    locale === "ar" && s.name_ar ? s.name_ar : s.name;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          {t("specialtiesTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("specialtiesSubtitle")}
        </p>
      </div>

      {fetching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : specialties.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("specialtiesEmpty")}
        </p>
      ) : (
        <ScrollArea className="h-56 rounded-md border">
          <div className="divide-y">
            {specialties.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                />
                <span>{labelFor(s)}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={loading}
            className="flex-1"
          >
            <ArrowLeft className="me-2 h-4 w-4" />
            {t("back")}
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit([...selected])}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="me-2 h-4 w-4" />
            )}
            {t("continue")}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSubmit([])}
          disabled={loading}
          className="w-full text-muted-foreground"
        >
          {t("skipForNow")}
        </Button>
      </div>
    </div>
  );
}
