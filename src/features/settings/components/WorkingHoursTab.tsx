"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WeeklySchedule } from "../domain/models";
import { useModuleSettings, useSaveSettings, valuesByKey } from "../hooks/use-settings";
import { TabError, TabLoading } from "./tab-states";
import { WeeklyHoursEditor } from "./WeeklyHoursEditor";

export function WorkingHoursTab() {
  const t = useTranslations("settings");
  const { data, isLoading, error, refetch } = useModuleSettings("working_hours");
  const save = useSaveSettings();
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);

  const stored = valuesByKey(data)["working_hours.schedule"] as WeeklySchedule | undefined;
  useEffect(() => {
    if (stored && schedule === null) setSchedule(stored);
  }, [stored, schedule]);

  if (isLoading || (!error && !schedule)) return <TabLoading />;
  if (error) return <TabError message={error.message} onRetry={() => refetch()} />;
  if (!schedule) return <TabError onRetry={() => refetch()} />;

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>{t("workingHours.title")}</CardTitle>
          <CardDescription>{t("workingHours.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyHoursEditor schedule={schedule} onChange={setSchedule} />
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-end">
        <Button
          disabled={save.isPending}
          onClick={() => save.mutate([{ key: "working_hours.schedule", value: schedule }])}
        >
          {save.isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
