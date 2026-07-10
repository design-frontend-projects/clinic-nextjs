"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReminderRule } from "../domain/models";
import { NOTIFICATION_CHANNELS } from "../domain/models";

interface ReminderRulesEditorProps {
  rules: ReminderRule[];
  onChange: (rules: ReminderRule[]) => void;
}

export function ReminderRulesEditor({ rules, onChange }: ReminderRulesEditorProps) {
  const t = useTranslations("settings");

  const updateRule = (index: number, patch: Partial<ReminderRule>) => {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  return (
    <div className="space-y-3">
      {rules.map((rule, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("appointments.channel")}</p>
            <Select
              value={rule.channel}
              onValueChange={(value) => updateRule(index, { channel: value as ReminderRule["channel"] })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {t(`channels.${channel}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("appointments.offsetHours")}</p>
            <Input
              type="number"
              min={1}
              max={720}
              className="w-28"
              value={rule.offset_hours}
              onChange={(event) => updateRule(index, { offset_hours: Number(event.target.value) })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.delete")}
            onClick={() => onChange(rules.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rules.length >= 10}
        onClick={() => onChange([...rules, { channel: "email", offset_hours: 24 }])}
      >
        <Plus className="size-4" />
        {t("appointments.addReminder")}
      </Button>
    </div>
  );
}
