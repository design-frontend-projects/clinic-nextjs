"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { buildDayTimeSlots } from "@/lib/booking-rules";
import { getDoctorBookedSlots } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface TimeSlotPickerProps {
  doctorId?: string;
  date?: Date;
  value?: Date;
  onChange: (next: Date) => void;
  excludeBookingId?: string;
  disablePast?: boolean;
  allowCustomTime?: boolean;
}

export function TimeSlotPicker({
  doctorId,
  date,
  value,
  onChange,
  excludeBookingId,
  disablePast = false,
  allowCustomTime = false,
}: TimeSlotPickerProps) {
  const t = useTranslations("pages.booking");

  const dayKey = date ? format(date, "yyyy-MM-dd") : "";
  const dayIso = date ? date.toISOString() : "";

  const { data: bookedIsoSlots = [], isLoading } = useQuery({
    queryKey: ["booking-slots", doctorId, dayKey, excludeBookingId ?? null],
    queryFn: () => getDoctorBookedSlots(doctorId!, dayIso, excludeBookingId),
    enabled: Boolean(doctorId && date),
  });

  const slots = useMemo(() => {
    if (!date) return [];
    const occupiedDates = bookedIsoSlots
      .map((iso) => new Date(iso))
      .filter((d) => !Number.isNaN(d.getTime()));
    return buildDayTimeSlots(date, occupiedDates);
  }, [date, bookedIsoSlots]);

  const selectedTime = value ? format(value, "HH:mm") : "";
  const isSameSelectedDay =
    Boolean(value && date) && format(value!, "yyyy-MM-dd") === dayKey;

  if (!doctorId || !date) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-dashed border-hairline bg-canvas-soft p-3 text-xs text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{t("selectDoctorAndDateForSlots")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-hairline bg-canvas-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{t("availableSlots")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-hairline bg-surface" />
            {t("slotAvailable")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {t("slotSelected")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            {t("slotBooked")}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-[var(--radius-button)]" />
          ))}
        </div>
      ) : (
        <ScrollArea className="max-h-48 pe-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const isSelected = isSameSelectedDay && selectedTime === slot.time;
              const isDisabled =
                slot.isOccupied || (disablePast && slot.isPast);
              const slotDate = new Date(slot.iso);

              return (
                <Button
                  key={slot.time}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  disabled={isDisabled}
                  onClick={() => onChange(slotDate)}
                  className={cn(
                    "h-8 justify-center px-2 text-xs font-medium tabular-nums",
                    !isSelected && "bg-surface hover:bg-accent",
                    slot.isOccupied &&
                      "line-through opacity-50 hover:bg-surface",
                  )}
                >
                  {format(slotDate, "h:mm a")}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {allowCustomTime && (
        <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
          <Label
            htmlFor="booking-custom-time"
            className="text-xs text-muted-foreground"
          >
            {t("customTime")}
          </Label>
          <Input
            id="booking-custom-time"
            type="time"
            className="h-8 w-36 bg-surface text-xs tabular-nums"
            value={isSameSelectedDay ? selectedTime : ""}
            onChange={(e) => {
              if (!e.target.value || !date) return;
              const [hoursStr, minsStr] = e.target.value.split(":");
              const hours = Number.parseInt(hoursStr ?? "", 10);
              const mins = Number.parseInt(minsStr ?? "", 10);
              if (Number.isNaN(hours) || Number.isNaN(mins)) return;
              const next = new Date(date);
              next.setHours(hours, mins, 0, 0);
              onChange(next);
            }}
          />
        </div>
      )}
    </div>
  );
}
