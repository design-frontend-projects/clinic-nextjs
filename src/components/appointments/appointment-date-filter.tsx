"use client";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Date scope for the staff appointment views.
 * - `today`   → the current local day
 * - `upcoming`→ today + future (`appointment_date >= now`)
 * - `all`     → no date bound
 * - `date`    → a specific picked calendar day (ISO date string in `date`)
 */
export interface ApptDateFilter {
  mode: "today" | "upcoming" | "all";
  /** Present only when a specific calendar day is picked; overrides `mode`. */
  date?: string;
}

export const DEFAULT_APPT_FILTER: ApptDateFilter = { mode: "today" };

interface AppointmentDateFilterProps {
  value: ApptDateFilter;
  onChange: (value: ApptDateFilter) => void;
  className?: string;
}

/**
 * Shared Today / Upcoming / All quick-buttons + a calendar day-picker used by
 * the staff dashboard and booking pages to filter the appointment list. Picking
 * a calendar day clears the quick-mode; the quick buttons clear the picked day.
 */
export function AppointmentDateFilter({
  value,
  onChange,
  className,
}: AppointmentDateFilterProps) {
  const t = useTranslations("pages.staff");

  const quickButtons: Array<{ mode: ApptDateFilter["mode"]; label: string }> = [
    { mode: "today", label: t("today") },
    { mode: "upcoming", label: t("upcoming") },
    { mode: "all", label: t("allDates") },
  ];

  const selectedDate = value.date ? new Date(value.date) : undefined;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {quickButtons.map((btn) => {
        const active = !value.date && value.mode === btn.mode;
        return (
          <Button
            key={btn.mode}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() => onChange({ mode: btn.mode })}
          >
            {btn.label}
          </Button>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={value.date ? "default" : "outline"}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "MMM d, yyyy") : t("pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(day) =>
              onChange(
                day
                  ? { mode: value.mode, date: day.toISOString() }
                  : { mode: value.mode },
              )
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
