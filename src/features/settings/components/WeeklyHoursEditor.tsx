"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DaySchedule, WeekDay, WeeklySchedule } from "../domain/models";
import { WEEK_DAYS } from "../domain/models";

interface WeeklyHoursEditorProps {
  schedule: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
}

export function WeeklyHoursEditor({ schedule, onChange }: WeeklyHoursEditorProps) {
  const t = useTranslations("settings");

  const updateDay = (day: WeekDay, patch: Partial<DaySchedule>) => {
    onChange({ ...schedule, [day]: { ...schedule[day], ...patch } });
  };

  return (
    <div className="space-y-3">
      {WEEK_DAYS.map((day) => {
        const config = schedule[day];
        return (
          <div key={day} className="flex flex-wrap items-center gap-4 rounded-md border border-border p-3">
            <div className="flex w-40 items-center gap-3">
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => updateDay(day, { enabled: checked === true })}
                aria-label={t(`days.${day}`)}
              />
              <span className="text-sm font-medium">{t(`days.${day}`)}</span>
            </div>
            {config.enabled ? (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">{t("workingHours.from")}</Label>
                <Input
                  type="time"
                  className="w-28"
                  value={config.start}
                  onChange={(event) => updateDay(day, { start: event.target.value })}
                />
                <Label className="text-xs text-muted-foreground">{t("workingHours.to")}</Label>
                <Input
                  type="time"
                  className="w-28"
                  value={config.end}
                  onChange={(event) => updateDay(day, { end: event.target.value })}
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
