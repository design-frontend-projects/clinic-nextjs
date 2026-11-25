"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Ban, CalendarOff, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import {
  buildDayTimeSlots,
  isDoctorWorkingOnDay,
  normalizeDoctorAvailability,
  parseTimeToMinutes,
} from "@/lib/booking-rules";
import { getDoctorBookedSlots } from "@/app/actions/booking";
import type { BookingDoctorOption, TimeSlotItem } from "@/types/booking.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface TimeSlotPickerProps {
  doctorId?: string;
  doctor?: BookingDoctorOption;
  date?: Date;
  value?: Date;
  onChange: (next: Date) => void;
  excludeBookingId?: string;
  disablePast?: boolean;
  allowCustomTime?: boolean;
}

export function TimeSlotPicker({
  doctorId,
  doctor,
  date,
  value,
  onChange,
  excludeBookingId,
  disablePast = false,
  allowCustomTime = false,
}: TimeSlotPickerProps) {
  const t = useTranslations("pages.booking");
  const tDaysShort = useTranslations("common.daysShort");

  const dayKey = date ? format(date, "yyyy-MM-dd") : "";
  const dayIso = date ? date.toISOString() : "";

  const availability = useMemo(
    () =>
      doctor
        ? normalizeDoctorAvailability({
            status: doctor.status,
            available_from: doctor.availableFrom,
            available_to: doctor.availableTo,
            slot_duration_minutes: doctor.slotDurationMinutes,
            available_days: doctor.availableDays,
          })
        : undefined,
    [doctor],
  );

  const isDoctorInactive = Boolean(availability && !availability.isActive);
  const isDayOff = Boolean(
    availability &&
      availability.isActive &&
      date &&
      !isDoctorWorkingOnDay(availability, date),
  );

  const { data: bookedIsoSlots = [], isLoading } = useQuery({
    queryKey: ["booking-slots", doctorId, dayKey, excludeBookingId ?? null],
    queryFn: () => getDoctorBookedSlots(doctorId!, dayIso, excludeBookingId),
    enabled: Boolean(doctorId && date && !isDoctorInactive && !isDayOff),
  });

  const slots = useMemo(() => {
    if (!date || isDoctorInactive || isDayOff) return [];
    const occupiedDates = bookedIsoSlots
      .map((iso) => new Date(iso))
      .filter((d) => !Number.isNaN(d.getTime()));
    return buildDayTimeSlots(
      date,
      occupiedDates,
      availability ? { availability } : undefined,
    );
  }, [date, bookedIsoSlots, availability, isDoctorInactive, isDayOff]);

  const groupedSlots = useMemo(() => {
    const morning: TimeSlotItem[] = [];
    const afternoon: TimeSlotItem[] = [];
    const evening: TimeSlotItem[] = [];

    for (const slot of slots) {
      const hour = Number.parseInt(slot.time.split(":")[0] ?? "0", 10);
      if (hour < 12) morning.push(slot);
      else if (hour < 17) afternoon.push(slot);
      else evening.push(slot);
    }

    return [
      { key: "morning", label: t("morningSlots"), items: morning },
      { key: "afternoon", label: t("afternoonSlots"), items: afternoon },
      { key: "evening", label: t("eveningSlots"), items: evening },
    ].filter((g) => g.items.length > 0);
  }, [slots, t]);

  const availableCount = useMemo(
    () =>
      slots.filter((s) => !s.isOccupied && !(disablePast && s.isPast)).length,
    [slots, disablePast],
  );

  const selectedTime = value ? format(value, "HH:mm") : "";
  const isSameSelectedDay =
    Boolean(value && date) && format(value!, "yyyy-MM-dd") === dayKey;

  const customTimeOutsideHours = useMemo(() => {
    if (!allowCustomTime || !availability || !isSameSelectedDay || !selectedTime) {
      return false;
    }
    const targetMin = parseTimeToMinutes(selectedTime);
    const startMin = parseTimeToMinutes(availability.availableFrom);
    const endMin = parseTimeToMinutes(availability.availableTo);
    if (targetMin === null || startMin === null || endMin === null) return false;
    return (
      targetMin < startMin ||
      targetMin + availability.slotDurationMinutes > endMin
    );
  }, [allowCustomTime, availability, isSameSelectedDay, selectedTime]);

  if (!doctorId || !date) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-dashed border-hairline bg-canvas-soft p-3 text-xs text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{t("selectDoctorAndDateForSlots")}</span>
      </div>
    );
  }

  if (isDoctorInactive) {
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-input)] border border-destructive/30 bg-accent-red-soft p-3 text-xs text-destructive">
        <Ban className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t("inactiveDoctorBanner")}</span>
      </div>
    );
  }

  if (isDayOff && availability) {
    const workingLabels = availability.availableDays
      .map((d) => tDaysShort(String(d)))
      .join(", ");
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-input)] border border-hairline bg-canvas-soft p-3 text-xs text-muted-foreground">
        <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">{t("dayOffBanner")}</p>
          <p>
            {t("workingDaysLabel")}: {workingLabels || "—"} ({availability.availableFrom} – {availability.availableTo})
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-hairline bg-canvas-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>{t("availableSlots")}</span>
          </span>
          {availability && (
            <>
              <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-medium tabular-nums">
                {availability.availableFrom} – {availability.availableTo}
              </Badge>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-medium tabular-nums">
                {t("durationMinutes", { minutes: availability.slotDurationMinutes })}
              </Badge>
            </>
          )}
          {!isLoading && (
            <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
              {t("openSlotsCount", { count: availableCount })}
            </span>
          )}
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
      ) : slots.length === 0 ? (
        <div className="rounded-[var(--radius-input)] border border-dashed border-hairline bg-surface px-3 py-4 text-center text-xs text-muted-foreground">
          {t("noSlotsAvailable")}
        </div>
      ) : (
        <ScrollArea className="max-h-56 pe-2">
          <div className="space-y-3">
            {groupedSlots.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {group.items.map((slot) => {
                    const isSelected =
                      isSameSelectedDay && selectedTime === slot.time;
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
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {allowCustomTime && (
        <div className="space-y-1.5 border-t border-hairline pt-2.5">
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="booking-custom-time"
              className="text-xs text-muted-foreground"
            >
              {t("customTime")}
            </Label>
            <Input
              id="booking-custom-time"
              type="time"
              min={availability?.availableFrom}
              max={availability?.availableTo}
              step={availability ? availability.slotDurationMinutes * 60 : undefined}
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
          {customTimeOutsideHours && availability && (
            <p className="text-[11px] text-destructive">
              {t("customTimeOutsideHours", {
                from: availability.availableFrom,
                to: availability.availableTo,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
