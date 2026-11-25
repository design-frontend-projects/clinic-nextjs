"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import {
  Ban,
  CalendarDays,
  CalendarOff,
  Clock,
  Stethoscope,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import {
  buildDayTimeSlots,
  isDoctorWorkingOnDay,
  normalizeDoctorAvailability,
} from "@/lib/booking-rules";
import { getDoctorBookedSlots } from "@/app/actions/booking";
import type {
  BookingContextData,
  BookingDoctorOption,
} from "@/types/booking.types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

interface BookingSlotsViewProps {
  context: BookingContextData;
  doctorFilter: string;
  onSelectSlot: (doctorId: string, slotDate: Date) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function DoctorSlotCard({
  doctor,
  date,
  isPatient,
  canCreate,
  onSelectSlot,
}: {
  doctor: BookingDoctorOption;
  date: Date;
  isPatient: boolean;
  canCreate: boolean;
  onSelectSlot: (doctorId: string, slotDate: Date) => void;
}) {
  const t = useTranslations("pages.booking");
  const tDaysShort = useTranslations("common.daysShort");

  const availability = useMemo(
    () =>
      normalizeDoctorAvailability({
        status: doctor.status,
        available_from: doctor.availableFrom,
        available_to: doctor.availableTo,
        slot_duration_minutes: doctor.slotDurationMinutes,
        available_days: doctor.availableDays,
      }),
    [doctor],
  );

  const isWorking = isDoctorWorkingOnDay(availability, date);
  const dayKey = format(date, "yyyy-MM-dd");
  const dayIso = date.toISOString();

  const { data: bookedIsoSlots = [], isLoading } = useQuery({
    queryKey: ["booking-slots", doctor.id, dayKey, null],
    queryFn: () => getDoctorBookedSlots(doctor.id, dayIso),
    enabled: Boolean(availability.isActive && isWorking),
  });

  const slots = useMemo(() => {
    if (!availability.isActive || !isWorking) return [];
    const occupiedDates = bookedIsoSlots
      .map((iso) => new Date(iso))
      .filter((d) => !Number.isNaN(d.getTime()));
    return buildDayTimeSlots(date, occupiedDates, { availability });
  }, [availability, isWorking, bookedIsoSlots, date]);

  const openCount = useMemo(
    () =>
      slots.filter((s) => !s.isOccupied && !(isPatient && s.isPast)).length,
    [slots, isPatient],
  );

  const workingDaysText = availability.availableDays
    .map((d) => tDaysShort(String(d)))
    .join(" · ");

  return (
    <Card className="py-0 overflow-hidden">
      <CardHeader className="border-b border-hairline bg-canvas-soft/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(doctor.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {doctor.fullName}
                </h3>
                <StatusBadge status={doctor.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {doctor.specialty && (
                  <span className="inline-flex items-center gap-1">
                    <Stethoscope className="h-3.5 w-3.5 text-primary/80" />
                    {doctor.specialty}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="h-3.5 w-3.5" />
                  {availability.availableFrom} – {availability.availableTo}
                </span>
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
                >
                  {t("durationMinutes", {
                    minutes: availability.slotDurationMinutes,
                  })}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {workingDaysText}
            </span>
            {availability.isActive && isWorking && !isLoading && (
              <Badge variant="outline" className="tabular-nums text-xs">
                {t("openSlotsCount", { count: openCount })}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {!availability.isActive ? (
          <div className="flex items-center gap-2.5 rounded-[var(--radius-input)] border border-destructive/20 bg-accent-red-soft px-3 py-3 text-xs text-destructive">
            <Ban className="h-4 w-4 shrink-0" />
            <span>{t("inactiveDoctorBanner")}</span>
          </div>
        ) : !isWorking ? (
          <div className="flex items-center gap-2.5 rounded-[var(--radius-input)] border border-dashed border-hairline bg-canvas-soft px-3 py-3 text-xs text-muted-foreground">
            <CalendarOff className="h-4 w-4 shrink-0 text-amber-500" />
            <span>{t("dayOffBanner")}</span>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-full rounded-[var(--radius-button)]"
              />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t("noSlotsAvailable")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {slots.map((slot) => {
              const slotDate = new Date(slot.iso);
              const isPastBlocked = isPatient && slot.isPast;
              const isDisabled = !canCreate || slot.isOccupied || isPastBlocked;

              return (
                <Button
                  key={slot.time}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isDisabled}
                  onClick={() => onSelectSlot(doctor.id, slotDate)}
                  className={cn(
                    "h-9 justify-center px-2 text-xs font-medium tabular-nums",
                    !isDisabled &&
                      "bg-surface hover:border-primary hover:bg-primary/5 hover:text-primary",
                    slot.isOccupied &&
                      "line-through opacity-50 hover:bg-surface",
                  )}
                >
                  {format(slotDate, "h:mm a")}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BookingSlotsView({
  context,
  doctorFilter,
  onSelectSlot,
}: BookingSlotsViewProps) {
  const t = useTranslations("pages.booking");
  const isPatient = context.roleScope === "patient";
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date()),
  );

  const doctors = useMemo(() => {
    if (context.roleScope === "doctor") {
      return context.doctors.filter((d) => d.id === context.profileId);
    }
    if (doctorFilter && doctorFilter !== "all") {
      return context.doctors.filter((d) => d.id === doctorFilter);
    }
    return context.doctors;
  }, [context.doctors, context.profileId, context.roleScope, doctorFilter]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const quickDates = useMemo(
    () => [
      { key: "today", label: t("quickToday"), date: today },
      { key: "tomorrow", label: t("quickTomorrow"), date: addDays(today, 1) },
      { key: "in2", label: t("quickInTwoDays"), date: addDays(today, 2) },
    ],
    [t, today],
  );

  return (
    <div className="space-y-4">
      <Card className="py-0">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {format(selectedDate, "EEEE, MMM d, yyyy")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {quickDates.map((qd) => {
              const isSelected =
                format(qd.date, "yyyy-MM-dd") ===
                format(selectedDate, "yyyy-MM-dd");
              return (
                <Button
                  key={qd.key}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => setSelectedDate(qd.date)}
                >
                  {qd.label}
                </Button>
              );
            })}
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(startOfDay(d))}
              disabledDates={isPatient ? (d) => d < today : undefined}
              className="w-full sm:w-48"
            />
          </div>
        </CardContent>
      </Card>

      {doctors.length === 0 ? (
        <Card className="py-10">
          <CardContent className="text-center text-sm text-muted-foreground">
            {t("noDoctorsForSlots")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {doctors.map((doctor) => (
            <DoctorSlotCard
              key={doctor.id}
              doctor={doctor}
              date={selectedDate}
              isPatient={isPatient}
              canCreate={context.canCreate}
              onSelectSlot={onSelectSlot}
            />
          ))}
        </div>
      )}
    </div>
  );
}
