"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import {
  AlertCircle,
  Building2,
  CalendarIcon,
  CheckCircle2,
  Clock,
  FlaskConical,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Pencil,
  Phone,
  Stethoscope,
  User,
  UserX,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import {
  cancelBooking,
  getBookingById,
  updateBooking,
} from "@/app/actions/booking";
import { APPOINTMENT_KEYS } from "@/lib/appointments/use-appointments-realtime";
import { appointmentStatusEnum } from "@/types/appointment.types";
import type {
  BookingContextData,
  BookingDoctorOption,
  BookingLockReason,
} from "@/types/booking.types";
import type { AppointmentStatus } from "@/types/staff.types";

import { TimeSlotPicker } from "@/components/bookings/time-slot-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const NO_BRANCH_SENTINEL = "__none__";

const editBookingFormSchema = z.object({
  doctor_id: z.string().uuid("Please select a doctor"),
  branch_id: z.string(),
  appointment_date: z.date({ message: "Please select a date and time" }),
  status: appointmentStatusEnum,
  notes: z.string().max(1000).optional(),
});

type EditBookingFormValues = z.infer<typeof editBookingFormSchema>;

interface BookingDetailSheetProps {
  bookingId: string | null;
  initialTab?: "view" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: BookingContextData;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function DoctorScheduleSummary({ doctor }: { doctor?: BookingDoctorOption }) {
  const t = useTranslations("pages.booking");
  const tDaysShort = useTranslations("common.daysShort");
  if (!doctor) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-input)] border border-hairline bg-canvas-soft px-3 py-2 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="font-medium text-foreground tabular-nums" dir="ltr">
        {doctor.availableFrom} – {doctor.availableTo}
      </span>
      <Badge
        variant="secondary"
        className="h-5 px-1.5 text-[10px] tabular-nums"
      >
        {t("durationMinutes", { minutes: doctor.slotDurationMinutes })}
      </Badge>
      <span className="text-[11px]">
        {doctor.availableDays.map((d) => tDaysShort(String(d))).join(" · ")}
      </span>
    </div>
  );
}

export function BookingDetailSheet({
  bookingId,
  initialTab = "view",
  open,
  onOpenChange,
  context,
}: BookingDetailSheetProps) {
  const t = useTranslations("pages.booking");
  const tStatus = useTranslations("enums.status");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? arLocale : undefined;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"view" | "edit">(initialTab);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setServerError(null);
    }
  }, [open, initialTab, bookingId]);

  const {
    data: booking,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["booking-detail", bookingId],
    queryFn: () => getBookingById(bookingId!),
    enabled: Boolean(open && bookingId),
  });

  const form = useForm<EditBookingFormValues>({
    resolver: zodResolver(editBookingFormSchema),
    defaultValues: {
      doctor_id: "",
      branch_id: NO_BRANCH_SENTINEL,
      appointment_date: new Date(),
      status: "scheduled",
      notes: "",
    },
  });

  useEffect(() => {
    if (!booking) return;
    form.reset({
      doctor_id: booking.doctor?.id ?? "",
      branch_id: booking.branch?.id ?? NO_BRANCH_SENTINEL,
      appointment_date: new Date(booking.appointmentDate),
      status: booking.status,
      notes: booking.notes ?? "",
    });
    setServerError(null);
  }, [booking, form]);

  // If booking is locked, keep view tab active
  useEffect(() => {
    if (booking && !booking.capabilities.canEditDetails && activeTab === "edit") {
      setActiveTab("view");
    }
  }, [booking, activeTab]);

  const lockMessage = useMemo(() => {
    const reason: BookingLockReason = booking?.capabilities.lockReason ?? null;
    if (!reason) return null;
    const map: Record<Exclude<BookingLockReason, null>, string> = {
      completed: t("lockCompleted"),
      cancelled: t("lockCancelled"),
      no_show: t("lockNoShow"),
      checked_in: t("lockCheckedIn"),
      past: t("lockPast"),
      no_permission: t("lockNoPermission"),
    };
    return map[reason];
  }, [booking, t]);

  function invalidateAllBookingQueries() {
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookings });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingDetail });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingSlots });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffAppointments });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffDashboard });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffQueue });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.doctor });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.admin });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.patientUpcoming });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.patientHistory });
    queryClient.invalidateQueries({ queryKey: ["owner-appointments-widget"] });
  }

  const updateMutation = useMutation({
    mutationFn: async (values: EditBookingFormValues) => {
      if (!booking) {
        return { error: t("bookingNotFound") };
      }
      return updateBooking({
        id: booking.id,
        doctor_id: booking.capabilities.canChangeDoctor
          ? values.doctor_id
          : undefined,
        branch_id: booking.capabilities.canChangeBranch
          ? values.branch_id === NO_BRANCH_SENTINEL
            ? null
            : values.branch_id
          : undefined,
        appointment_date: values.appointment_date.toISOString(),
        notes: values.notes ?? "",
        status: booking.capabilities.canOverrideTerminal
          ? values.status
          : undefined,
      });
    },
    onSuccess: (result) => {
      if ("error" in result) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }
      setServerError(null);
      invalidateAllBookingQueries();
      toast.success(t("toastUpdated"));
      setActiveTab("view");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: AppointmentStatus) => {
      if (!booking) return { error: t("bookingNotFound") };
      if (status === "cancelled") {
        return cancelBooking(booking.id);
      }
      return updateBooking({ id: booking.id, status });
    },
    onSuccess: (result, status) => {
      if ("error" in result) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }
      setServerError(null);
      setConfirmCancelOpen(false);
      invalidateAllBookingQueries();
      toast.success(
        status === "cancelled" ? t("toastCancelled") : t("toastStatusUpdated"),
      );
    },
  });

  const watchedDoctorId = form.watch("doctor_id");
  const watchedDate = form.watch("appointment_date");
  const selectedDoctor = useMemo(
    () => context.doctors.find((d) => d.id === watchedDoctorId),
    [context.doctors, watchedDoctorId],
  );

  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const tomorrowStart = useMemo(() => addDays(todayStart, 1), [todayStart]);

  const isDateDisabled = useMemo(() => {
    return (d: Date) => {
      if (context.roleScope === "patient" && d < todayStart) return true;
      if (selectedDoctor && !selectedDoctor.availableDays.includes(d.getDay())) {
        return true;
      }
      return false;
    };
  }, [context.roleScope, selectedDoctor, todayStart]);

  const applyDayToField = (
    selectedDay: Date | undefined,
    currentValue: Date | undefined,
    onChange: (next: Date) => void,
  ) => {
    if (!selectedDay) return;
    const next = new Date(selectedDay);
    if (currentValue) {
      next.setHours(currentValue.getHours(), currentValue.getMinutes(), 0, 0);
    } else {
      const [hStr, mStr] = (selectedDoctor?.availableFrom ?? "09:00").split(":");
      next.setHours(
        Number.parseInt(hStr ?? "9", 10),
        Number.parseInt(mStr ?? "0", 10),
        0,
        0,
      );
    }
    onChange(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={locale === "ar" ? "left" : "right"}
          className="flex w-full flex-col gap-0 border-hairline bg-surface p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-hairline px-6 py-5">
            <div className="flex flex-wrap items-center gap-2 pe-6">
              <SheetTitle className="text-lg font-bold tracking-tight">
                {t("sheetTitle")}
              </SheetTitle>
              {booking && (
                <>
                  <Badge variant="outline" className="font-mono text-xs">
                    #{booking.id.slice(0, 8).toUpperCase()}
                  </Badge>
                  <StatusBadge status={booking.status} />
                </>
              )}
            </div>
            <SheetDescription>{t("sheetDescription")}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-5 p-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : isError || !booking ? (
                <Card>
                  <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    <span>{t("bookingNotFound")}</span>
                  </CardContent>
                </Card>
              ) : (
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => {
                    setServerError(null);
                    setActiveTab(val as "view" | "edit");
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="view">{t("tabDetails")}</TabsTrigger>
                    <TabsTrigger
                      value="edit"
                      disabled={!booking.capabilities.canEditDetails}
                    >
                      {t("tabEdit")}
                    </TabsTrigger>
                  </TabsList>

                  {serverError && (
                    <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-input)] border border-destructive/30 bg-accent-red-soft p-3 text-xs text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <TabsContent value="view" className="mt-4 space-y-4">
                    {lockMessage && (
                      <div className="flex items-start gap-2.5 rounded-[var(--radius-input)] border border-hairline bg-canvas-soft p-3 text-xs text-muted-foreground">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{lockMessage}</span>
                      </div>
                    )}

                    {/* Date & Time card */}
                    <Card className="py-0">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("scheduledFor")}
                          </span>
                          {booking.branch && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Building2 className="h-3 w-3" />
                              {booking.branch.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            <span>
                              {format(
                                new Date(booking.appointmentDate),
                                "EEEE, MMM d, yyyy",
                                { locale: dateLocale },
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-semibold tabular-nums text-foreground">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>
                              {format(new Date(booking.appointmentDate), "h:mm a", {
                                locale: dateLocale,
                              })}
                            </span>
                          </div>
                        </div>
                        {booking.checkedInAt && (
                          <p className="text-xs text-accent-yellow">
                            {t("checkedInAtTime", {
                              time: format(
                                new Date(booking.checkedInAt),
                                "MMM d, h:mm a",
                                { locale: dateLocale },
                              ),
                            })}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Doctor card */}
                    <Card className="py-0">
                      <CardContent className="flex items-center gap-3.5 p-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(
                              booking.doctor?.fullName || t("unassignedDoctor"),
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("colDoctor")}
                          </p>
                          <p className="truncate text-sm font-semibold text-foreground">
                            {booking.doctor?.fullName || t("unassignedDoctor")}
                          </p>
                          {booking.doctor?.specialty && (
                            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Stethoscope className="h-3 w-3" />
                              {booking.doctor.specialty}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Patient card (shown for clinic roles) */}
                    {context.roleScope !== "patient" && (
                      <Card className="py-0">
                        <CardContent className="flex items-start gap-3.5 p-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                              {getInitials(booking.patient.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {t("colPatient")}
                            </p>
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              {booking.patient.fullName}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {booking.patient.phone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {booking.patient.phone}
                                </span>
                              )}
                              {booking.patient.email && (
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {booking.patient.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Notes & clinical activity */}
                    <Card className="py-0">
                      <CardContent className="space-y-3 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("visitNotes")}
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {booking.notes || t("noNotes")}
                        </p>

                        {(booking.encountersCount > 0 ||
                          booking.labOrdersCount > 0) && (
                          <>
                            <Separator />
                            <div className="flex flex-wrap items-center gap-2">
                              {booking.encountersCount > 0 && (
                                <Badge variant="secondary">
                                  {t("encountersBadge", {
                                    count: booking.encountersCount,
                                  })}
                                </Badge>
                              )}
                              {booking.labOrdersCount > 0 && (
                                <Badge variant="secondary" className="gap-1">
                                  <FlaskConical className="h-3 w-3" />
                                  {t("labsBadge", {
                                    count: booking.labOrdersCount,
                                  })}
                                </Badge>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Quick actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {booking.capabilities.canCheckIn && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate("checked_in")}
                          >
                            <LogIn className="me-1.5 h-3.5 w-3.5" />
                            {t("actionCheckIn")}
                          </Button>
                        )}
                        {booking.capabilities.canComplete && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate("completed")}
                          >
                            <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
                            {t("actionComplete")}
                          </Button>
                        )}
                        {booking.capabilities.canMarkNoShow && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate("no_show")}
                          >
                            <UserX className="me-1.5 h-3.5 w-3.5" />
                            {t("actionNoShow")}
                          </Button>
                        )}
                        {booking.capabilities.canCancel && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={statusMutation.isPending}
                            onClick={() => setConfirmCancelOpen(true)}
                          >
                            <XCircle className="me-1.5 h-3.5 w-3.5" />
                            {t("actionCancel")}
                          </Button>
                        )}
                      </div>

                      {booking.capabilities.canEditDetails && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setActiveTab("edit")}
                        >
                          <Pencil className="me-1.5 h-3.5 w-3.5" />
                          {t("editBookingCta")}
                        </Button>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="edit" className="mt-4">
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit((values) =>
                          updateMutation.mutate(values),
                        )}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label
                            htmlFor="booking-edit-patient-name"
                            className="flex items-center gap-1.5"
                          >
                            <span>{t("patientLabel")}</span>
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          </Label>
                          <Input
                            id="booking-edit-patient-name"
                            value={booking.patient.fullName}
                            disabled
                            readOnly
                            className="cursor-not-allowed bg-muted/60 text-foreground disabled:opacity-80"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("patientReadonlyHint")}
                          </p>
                        </div>

                        <FormField
                          control={form.control}
                          name="doctor_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("doctorLabel")}</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={!booking.capabilities.canChangeDoctor}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={t("selectDoctor")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {context.doctors.map((doctor) => {
                                    const isInactive =
                                      doctor.status !== "active" &&
                                      doctor.id !== booking.doctor?.id;
                                    return (
                                      <SelectItem
                                        key={doctor.id}
                                        value={doctor.id}
                                        disabled={isInactive}
                                      >
                                        {doctor.fullName}
                                        {doctor.specialty
                                          ? ` — ${doctor.specialty}`
                                          : ""}
                                        {doctor.status !== "active"
                                          ? ` (${tStatus(doctor.status)})`
                                          : ""}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {context.branches.length > 0 && (
                          <FormField
                            control={form.control}
                            name="branch_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("branchLabel")}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={!booking.capabilities.canChangeBranch}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue
                                        placeholder={t("selectBranch")}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value={NO_BRANCH_SENTINEL}>
                                      {t("noBranchSelected")}
                                    </SelectItem>
                                    {context.branches.map((branch) => (
                                      <SelectItem key={branch.id} value={branch.id}>
                                        {branch.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <DoctorScheduleSummary doctor={selectedDoctor} />

                        {booking.capabilities.canOverrideTerminal && (
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("statusOverrideLabel")}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(
                                      [
                                        "scheduled",
                                        "checked_in",
                                        "completed",
                                        "cancelled",
                                        "no_show",
                                      ] as const
                                    ).map((st) => (
                                      <SelectItem key={st} value={st}>
                                        {tStatus(st)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={form.control}
                          name="appointment_date"
                          render={({ field }) => {
                            const isTodaySelected = Boolean(
                              field.value && isSameDay(field.value, todayStart),
                            );
                            const isTomorrowSelected = Boolean(
                              field.value && isSameDay(field.value, tomorrowStart),
                            );
                            return (
                              <FormItem className="flex flex-col space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <FormLabel>{t("dateLabel")}</FormLabel>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "h-7 px-2.5 text-xs transition-colors",
                                        isTodaySelected &&
                                          "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                                      )}
                                      disabled={isDateDisabled(todayStart)}
                                      onClick={() =>
                                        applyDayToField(
                                          todayStart,
                                          field.value,
                                          field.onChange,
                                        )
                                      }
                                    >
                                      {t("quickToday")}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "h-7 px-2.5 text-xs transition-colors",
                                        isTomorrowSelected &&
                                          "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                                      )}
                                      disabled={isDateDisabled(tomorrowStart)}
                                      onClick={() =>
                                        applyDayToField(
                                          tomorrowStart,
                                          field.value,
                                          field.onChange,
                                        )
                                      }
                                    >
                                      {t("quickTomorrow")}
                                    </Button>
                                  </div>
                                </div>

                                <DatePicker
                                  value={field.value}
                                  onChange={(selectedDay) =>
                                    applyDayToField(
                                      selectedDay,
                                      field.value,
                                      field.onChange,
                                    )
                                  }
                                  placeholder={t("pickDate")}
                                  dateFormat="PPPp"
                                  disabledDates={isDateDisabled}
                                />

                                <TimeSlotPicker
                                  doctorId={watchedDoctorId}
                                  doctor={selectedDoctor}
                                  date={watchedDate}
                                  value={field.value}
                                  onChange={field.onChange}
                                  excludeBookingId={booking.id}
                                  disablePast={context.roleScope === "patient"}
                                  allowCustomTime={context.roleScope !== "patient"}
                                />
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("notesLabel")}</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={3}
                                  placeholder={t("notesPlaceholder")}
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActiveTab("view")}
                          >
                            {t("btnCancel")}
                          </Button>
                          <Button
                            type="submit"
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending && (
                              <Loader2 className="me-2 h-4 w-4 animate-spin" />
                            )}
                            {t("saveChanges")}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepBooking")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={statusMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                statusMutation.mutate("cancelled");
              }}
            >
              {statusMutation.isPending && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {t("confirmCancelButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
