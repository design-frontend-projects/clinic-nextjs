"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import type { Matcher } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledDates?: Matcher | Matcher[];
  captionLayout?: "label" | "dropdown";
  fromYear?: number;
  toYear?: number;
  clearable?: boolean;
  showTodayButton?: boolean;
  todayLabel?: string;
  clearLabel?: string;
  dateFormat?: string;
  id?: string;
  className?: string;
}

/**
 * Reusable, responsive, RTL-safe DatePicker built on shadcn Popover + Calendar.
 * Supports month/year dropdown navigation for DOBs, clear button (as a sibling
 * to avoid nested buttons), Today shortcut, and collision-safe mobile popovers.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  disabledDates,
  captionLayout = "label",
  fromYear = 1900,
  toYear = new Date().getFullYear() + 5,
  clearable = false,
  showTodayButton = false,
  todayLabel = "Today",
  clearLabel = "Clear",
  dateFormat = "PPP",
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const showClear = Boolean(clearable && value && !disabled);
  const defaultMonth =
    value ?? (captionLayout === "dropdown" ? new Date(1990, 0, 1) : undefined);

  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-start font-normal",
              showClear && "pe-9",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="me-2 h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">
              {value ? format(value, dateFormat) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-1.5rem)] p-0"
          align="start"
          collisionPadding={12}
        >
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={defaultMonth}
            captionLayout={captionLayout}
            startMonth={new Date(fromYear, 0, 1)}
            endMonth={new Date(toYear, 11, 31)}
            disabled={disabledDates}
            onSelect={(selectedDay) => {
              onChange(selectedDay);
              if (selectedDay) {
                setOpen(false);
              }
            }}
            initialFocus
          />
          {showTodayButton && (
            <div className="flex items-center justify-between border-t border-hairline px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const today = new Date();
                  onChange(today);
                  setOpen(false);
                }}
              >
                {todayLabel}
              </Button>
              {value && clearable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  {clearLabel}
                </Button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {showClear && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={(e) => {
            e.stopPropagation();
            onChange(undefined);
          }}
          className="absolute end-2.5 flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
