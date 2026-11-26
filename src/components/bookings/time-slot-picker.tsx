"use client";

import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import {
  AlertCircle,
  Ban,
  CalendarOff,
  Check,
  Clock,
  Moon,
  Sun,
  Sunrise,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

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
import { Skeleton } from "@/components/ui/skeleton";

type PeriodKey = "morning" | "afternoon" | "evening";
type PeriodFilter = "all" | PeriodKey;

interface TimeSlotPickerProps {
  doctorId?: string;
  doctor?: BookingDoctorOption;
  date?: Date;
  value?: Date;
  onChange: (next: Date) => void;
  excludeBookingId?: string;
  disablePast?: boolean;
  allowCustomTime?: boolean;
  className?: string;
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
  className,
}: TimeSlotPickerProps) {
  const t = useTranslations("pages.booking");
  const tDaysShort = useTranslations("common.daysShort");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? arLocale : undefined;
  const customTimeId = useId();

  const dayKey = date ? format(date, "yyyy-MM-dd") : "";
  const dayIso = date ? date.toISOString() : "";
  const contextKey = `${doctorId ?? ""}|${dayKey}`;

  const [periodState, setPeriodState] = useState<{
    contextKey: string;
    period: PeriodFilter;
  }>({ contextKey: "", period: "all" });

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

    const groups: Array<{
      key: PeriodKey;
      label: string;
      icon: typeof Sunrise;
      items: TimeSlotItem[];
      openCount: number;
    }> = [
      {
        key: "morning",
        label: t("morningSlots"),
        icon: Sunrise,
        items: morning,
        openCount: morning.filter(
          (s) => !s.isOccupied && !(disablePast && s.isPast),
        ).length,
      },
      {
        key: "afternoon",
        label: t("afternoonSlots"),
        icon: Sun,
        items: afternoon,
        openCount: afternoon.filter(
          (s) => !s.isOccupied && !(disablePast && s.isPast),
        ).length,
      },
      {
        key: "evening",
        label: t("eveningSlots"),
        icon: Moon,
        items: evening,
        openCount: evening.filter(
          (s) => !s.isOccupied && !(disablePast && s.isPast),
        ).length,
      },
    ];

    return groups.filter((g) => g.items.length > 0);
  }, [slots, disablePast, t]);

  const periodFilter: PeriodFilter =
    periodState.contextKey === contextKey &&
    (periodState.period === "all" ||
      groupedSlots.some((g) => g.key === periodState.period))
      ? periodState.period
      : "all";

  const visibleGroups = useMemo(
    () =>
      periodFilter === "all"
        ? groupedSlots
        : groupedSlots.filter((g) => g.key === periodFilter),
    [groupedSlots, periodFilter],
  );

  const availableCount = useMemo(
    () =>
      slots.filter((s) => !s.isOccupied && !(disablePast && s.isPast)).length,
    [slots, disablePast],
  );

  const selectedTime = value ? format(value, "HH:mm") : "";
  const isSameSelectedDay =
    Boolean(value && date) && format(value!, "yyyy-MM-dd") === dayKey;

  const customTimeOutsideHours = useMemo(() => {
    if (
      !allowCustomTime ||
      !availability ||
      !isSameSelectedDay ||
      !selectedTime
    ) {
      return false;
    }
    const targetMin = parseTimeToMinutes(selectedTime);
    const startMin = parseTimeToMinutes(availability.availableFrom);
    const endMin = parseTimeToMinutes(availability.availableTo);
    if (targetMin === null || startMin === null || endMin === null)
      return false;
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
            {t("workingDaysLabel")}: {workingLabels || "—"} (
            <span dir="ltr">
              {availability.availableFrom} – {availability.availableTo}
            </span>
            )
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-canvas-soft/70",
        className,
      )}
    >
      {/* Zone 1: Header, schedule badges, period filter & legend */}
      <div className="space-y-2.5 border-b border-hairline bg-surface/70 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{t("availableSlots")}</span>
            </span>
            {!isLoading && (
              <span
                className={cn(
                  "rounded-[var(--radius-badge)] px-2 py-0.5 text-[11px] font-medium tabular-nums",
                  availableCount > 0
                    ? "bg-accent-green-soft text-accent-green"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {t("openSlotsCount", { count: availableCount })}
              </span>
            )}
          </div>

          {availability && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
              >
                <span dir="ltr">
                  {availability.availableFrom} – {availability.availableTo}
                </span>
              </Badge>
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
              >
                {t("durationMinutes", {
                  minutes: availability.slotDurationMinutes,
                })}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {!isLoading && groupedSlots.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={periodFilter === "all"}
                onClick={() => setPeriodState({ contextKey, period: "all" })}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] px-2.5 text-[11px] transition-colors cursor-pointer",
                  periodFilter === "all"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "border border-hairline bg-canvas-soft text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span>{t("allPeriods")}</span>
                <span className="tabular-nums opacity-80">
                  ({availableCount})
                </span>
              </button>
              {groupedSlots.map((group) => {
                const isActive = periodFilter === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setPeriodState({ contextKey, period: group.key })
                    }
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] px-2.5 text-[11px] transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "border border-hairline bg-canvas-soft text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <span>{group.label}</span>
                    <span className="tabular-nums opacity-80">
                      ({group.openCount})
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-foreground/35 bg-surface" />
              {t("slotAvailable")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              {t("slotSelected")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/60 bg-muted" />
              {t("slotBooked")}
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2: Strictly bounded scrollable slot grid */}
      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-full rounded-[var(--radius-button)]"
              />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-[var(--radius-input)] border border-dashed border-hairline bg-surface px-3 py-5 text-center text-xs text-muted-foreground">
            {t("noSlotsAvailable")}
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto overscroll-contain pe-1 sm:max-h-64">
            <div className="space-y-3.5">
              {visibleGroups.map((group) => {
                const PeriodIcon = group.icon;
                return (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <PeriodIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {group.label}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground/80">
                        ({group.openCount})
                      </span>
                      <div className="h-px flex-1 bg-hairline-soft" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4">
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
                            aria-pressed={isSelected}
                            onClick={() => onChange(slotDate)}
                            className={cn(
                              "h-9 w-full min-w-0 justify-center gap-1 px-2 text-xs font-medium tabular-nums transition-all",
                              isSelected &&
                                "border-primary bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/25 font-semibold",
                              !isSelected &&
                                !isDisabled &&
                                "border-hairline bg-surface text-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary",
                              isDisabled &&
                                "cursor-not-allowed border-dashed border-hairline bg-muted/70 text-muted-foreground/60 line-through hover:bg-muted/70",
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 shrink-0" />
                            )}
                            <span dir="ltr" className="truncate">
                              {format(slotDate, "h:mm a", {
                                locale: dateLocale,
                              })}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Zone 3: Isolated custom time footer */}
      {allowCustomTime && (
        <div className="space-y-1.5 border-t border-hairline bg-surface/80 px-3.5 py-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label
              htmlFor={customTimeId}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("customTime")}
            </Label>
            <Input
              id={customTimeId}
              type="time"
              dir="ltr"
              min={availability?.availableFrom}
              max={availability?.availableTo}
              step={
                availability ? availability.slotDurationMinutes * 60 : undefined
              }
              className="h-9 w-full bg-surface text-xs tabular-nums sm:w-40"
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
            <p className="flex items-center gap-1.5 text-[11px] text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t("customTimeOutsideHours", {
                  from: availability.availableFrom,
                  to: availability.availableTo,
                })}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
