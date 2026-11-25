"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import {
  AlertCircle,
  CalendarPlus,
  Check,
  ChevronsUpDown,
  Clock,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import {
  createBooking,
  registerPatientAndCreateBooking,
  searchBookingPatients,
} from "@/app/actions/booking";
import { APPOINTMENT_KEYS } from "@/lib/appointments/use-appointments-realtime";
import {
  createAppointmentWithPatientSchema,
  type CreateAppointmentWithPatientData,
} from "@/types/appointment.types";
import type {
  BookingContextData,
  BookingDoctorOption,
} from "@/types/booking.types";

import { TimeSlotPicker } from "@/components/bookings/time-slot-picker";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const NO_BRANCH_SENTINEL = "__none__";

const createFormSchema = z.object({
  patient_id: z.string().optional(),
  doctor_id: z.string().uuid("Please select a doctor"),
  branch_id: z.string(),
  appointment_date: z.date({ message: "Please select a date and time" }),
  notes: z.string().max(1000).optional(),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

export interface BookingCreatePrefill {
  doctorId?: string;
  appointmentDate?: Date;
}

interface BookingCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: BookingContextData;
  prefill?: BookingCreatePrefill | null;
}

function DoctorScheduleSummary({ doctor }: { doctor?: BookingDoctorOption }) {
  const t = useTranslations("pages.booking");
  const tDaysShort = useTranslations("common.daysShort");
  if (!doctor) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-input)] border border-hairline bg-canvas-soft px-3 py-2 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="font-medium text-foreground tabular-nums">
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

export function BookingCreateDialog({
  open,
  onOpenChange,
  context,
  prefill,
}: BookingCreateDialogProps) {
  const t = useTranslations("pages.booking");
  const tDialog = useTranslations("appointments.newDialog");
  const tGender = useTranslations("enums.gender");
  const tStatus = useTranslations("enums.status");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const isPatient = context.roleScope === "patient";
  const isDoctor = context.roleScope === "doctor";

  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatientLabel, setSelectedPatientLabel] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [tempPasswordInfo, setTempPasswordInfo] =
    useState<TempPasswordInfo | null>(null);

  const defaultBranchId =
    context.branchId ??
    context.branches.find((b) => b.isPrimary)?.id ??
    NO_BRANCH_SENTINEL;
  const defaultDoctorId = isDoctor ? context.profileId : "";

  const existingForm = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      patient_id: "",
      doctor_id: defaultDoctorId,
      branch_id: defaultBranchId,
      appointment_date: undefined,
      notes: "",
    },
  });

  const newPatientForm = useForm<
    z.input<typeof createAppointmentWithPatientSchema>,
    unknown,
    CreateAppointmentWithPatientData
  >({
    resolver: zodResolver(createAppointmentWithPatientSchema),
    defaultValues: {
      patient: {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        gender: undefined,
      },
      appointment: {
        doctor_id: defaultDoctorId,
        status: "scheduled",
        notes: "",
      },
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      setActiveTab("existing");
      const initialDoctorId = prefill?.doctorId || defaultDoctorId;
      const initialDate = prefill?.appointmentDate
        ? new Date(prefill.appointmentDate)
        : undefined;

      existingForm.reset({
        patient_id: "",
        doctor_id: initialDoctorId,
        branch_id: defaultBranchId,
        appointment_date: initialDate,
        notes: "",
      });
      newPatientForm.reset({
        patient: {
          first_name: "",
          last_name: "",
          email: "",
          phone: "",
          address: "",
          gender: undefined,
        },
        appointment: {
          doctor_id: initialDoctorId,
          appointment_date: initialDate,
          status: "scheduled",
          notes: "",
        },
      });
      setSelectedPatientLabel("");
      setPatientQuery("");
    }
  }, [
    open,
    prefill,
    defaultDoctorId,
    defaultBranchId,
    existingForm,
    newPatientForm,
  ]);

  const { data: patientResults = [], isLoading: isSearchingPatients } =
    useQuery({
      queryKey: ["booking-patients-search", patientQuery],
      queryFn: () => searchBookingPatients(patientQuery),
      enabled: !isPatient && patientQuery.trim().length >= 2,
    });

  function invalidateAllBookingQueries() {
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookings });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingSlots });
    queryClient.invalidateQueries({
      queryKey: APPOINTMENT_KEYS.staffAppointments,
    });
    queryClient.invalidateQueries({
      queryKey: APPOINTMENT_KEYS.staffDashboard,
    });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffQueue });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.doctor });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.admin });
    queryClient.invalidateQueries({
      queryKey: APPOINTMENT_KEYS.patientUpcoming,
    });
    queryClient.invalidateQueries({
      queryKey: APPOINTMENT_KEYS.patientHistory,
    });
  }

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) =>
      createBooking({
        patient_id: isPatient ? undefined : values.patient_id,
        doctor_id: values.doctor_id,
        branch_id:
          context.branches.length > 0 && !context.branchLocked
            ? values.branch_id === NO_BRANCH_SENTINEL
              ? null
              : values.branch_id
            : undefined,
        appointment_date: values.appointment_date.toISOString(),
        notes: values.notes,
      }),
    onSuccess: (result) => {
      if ("error" in result) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }
      invalidateAllBookingQueries();
      toast.success(t("toastCreated"));
      onOpenChange(false);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: CreateAppointmentWithPatientData) =>
      registerPatientAndCreateBooking(data),
    onSuccess: (result, variables) => {
      if ("error" in result) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }
      invalidateAllBookingQueries();
      toast.success(t("toastCreated"));
      onOpenChange(false);
      if (result.tempPassword) {
        setTempPasswordInfo({
          tempPassword: result.tempPassword,
          fullName:
            `${variables.patient.first_name} ${variables.patient.last_name}`.trim(),
          email: variables.patient.email,
          phone: variables.patient.phone,
        });
      }
    },
  });

  const watchedExistingDoctorId = existingForm.watch("doctor_id");
  const watchedExistingDate = existingForm.watch("appointment_date");
  const watchedNewDoctorId = newPatientForm.watch("appointment.doctor_id");
  const watchedNewDate = newPatientForm.watch("appointment.appointment_date");

  const selectedExistingDoctor = useMemo(
    () => context.doctors.find((d) => d.id === watchedExistingDoctorId),
    [context.doctors, watchedExistingDoctorId],
  );
  const selectedNewDoctor = useMemo(
    () => context.doctors.find((d) => d.id === watchedNewDoctorId),
    [context.doctors, watchedNewDoctorId],
  );

  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const tomorrowStart = useMemo(() => addDays(todayStart, 1), [todayStart]);

  const makeDisabledDateCheck = (doctor?: BookingDoctorOption) => {
    return (d: Date) => {
      if (isPatient && d < todayStart) return true;
      if (doctor && !doctor.availableDays.includes(d.getDay())) return true;
      return false;
    };
  };

  const applyDayToField = (
    selectedDay: Date | undefined,
    currentValue: Date | undefined,
    doctor: BookingDoctorOption | undefined,
    onChange: (next: Date) => void,
  ) => {
    if (!selectedDay) return;
    const next = new Date(selectedDay);
    if (currentValue) {
      next.setHours(currentValue.getHours(), currentValue.getMinutes(), 0, 0);
    } else {
      const [hStr, mStr] = (doctor?.availableFrom ?? "09:00").split(":");
      next.setHours(
        Number.parseInt(hStr ?? "9", 10),
        Number.parseInt(mStr ?? "0", 10),
        0,
        0,
      );
    }
    onChange(next);
  };

  const renderDoctorSelectItems = () =>
    context.doctors.map((doctor) => {
      const isInactive = doctor.status !== "active";
      return (
        <SelectItem key={doctor.id} value={doctor.id} disabled={isInactive}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">
              {doctor.fullName}
              {doctor.specialty ? ` — ${doctor.specialty}` : ""}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {isInactive
                ? `(${tStatus(doctor.status)})`
                : `${doctor.availableFrom}–${doctor.availableTo} · ${doctor.slotDurationMinutes}m`}
            </span>
          </div>
        </SelectItem>
      );
    });

  const existingFormBody = (
    <Form {...existingForm}>
      <form
        onSubmit={existingForm.handleSubmit((values) => {
          if (!isPatient && !values.patient_id) {
            existingForm.setError("patient_id", {
              message: "Please select a patient",
            });
            return;
          }
          setServerError(null);
          createMutation.mutate(values);
        })}
        className="space-y-4"
      >
        {!isPatient && (
          <FormField
            control={existingForm.control}
            name="patient_id"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{tDialog("patientLabel")}</FormLabel>
                <Popover
                  open={patientDropdownOpen}
                  onOpenChange={setPatientDropdownOpen}
                >
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">
                          {field.value && selectedPatientLabel
                            ? selectedPatientLabel
                            : tDialog("selectPatient")}
                        </span>
                        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(360px,calc(100vw-2rem))] p-0"
                    align="start"
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={tDialog("searchPatientsPlaceholder")}
                        value={patientQuery}
                        onValueChange={setPatientQuery}
                      />
                      <CommandList>
                        {patientResults.length === 0 &&
                          patientQuery.trim().length >= 2 &&
                          !isSearchingPatients && (
                            <CommandEmpty>
                              {tDialog("noPatientsFound")}
                            </CommandEmpty>
                          )}
                        {isSearchingPatients && (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            <Loader2 className="me-2 inline h-4 w-4 animate-spin" />
                            {tDialog("searching")}
                          </div>
                        )}
                        <CommandGroup>
                          {patientResults.map((patient) => {
                            const name =
                              `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
                            return (
                              <CommandItem
                                key={patient.id}
                                value={patient.id}
                                onSelect={() => {
                                  existingForm.setValue(
                                    "patient_id",
                                    patient.id,
                                    {
                                      shouldValidate: true,
                                    },
                                  );
                                  setSelectedPatientLabel(name);
                                  setPatientDropdownOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "me-2 h-4 w-4",
                                    patient.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <span>{name}</span>
                                <span className="ms-2 text-xs text-muted-foreground">
                                  {patient.phone || patient.email}
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={existingForm.control}
            name="doctor_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("doctorLabel")}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDoctor}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectDoctor")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>{renderDoctorSelectItems()}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {context.branches.length > 0 && (
            <FormField
              control={existingForm.control}
              name="branch_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("branchLabel")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={context.branchLocked}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("selectBranch")} />
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
        </div>

        <DoctorScheduleSummary doctor={selectedExistingDoctor} />

        <FormField
          control={existingForm.control}
          name="appointment_date"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FormLabel>{t("dateLabel")}</FormLabel>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={makeDisabledDateCheck(selectedExistingDoctor)(
                      todayStart,
                    )}
                    onClick={() =>
                      applyDayToField(
                        todayStart,
                        field.value,
                        selectedExistingDoctor,
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
                    className="h-7 px-2 text-xs"
                    disabled={makeDisabledDateCheck(selectedExistingDoctor)(
                      tomorrowStart,
                    )}
                    onClick={() =>
                      applyDayToField(
                        tomorrowStart,
                        field.value,
                        selectedExistingDoctor,
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
                    selectedExistingDoctor,
                    field.onChange,
                  )
                }
                placeholder={t("pickDate")}
                dateFormat="PPPp"
                disabledDates={makeDisabledDateCheck(selectedExistingDoctor)}
              />

              <TimeSlotPicker
                doctorId={watchedExistingDoctorId}
                doctor={selectedExistingDoctor}
                date={watchedExistingDate}
                value={field.value}
                onChange={field.onChange}
                disablePast={isPatient}
                allowCustomTime={!isPatient}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={existingForm.control}
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

        <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {t("btnCancel")}
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            )}
            {t("confirmBookingCta")}
          </Button>
        </div>
      </form>
    </Form>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-hairline bg-surface p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-hairline px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-start">
                <DialogTitle>
                  {isPatient ? t("createTitlePatient") : t("createTitleStaff")}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                  {isPatient
                    ? t("createSubtitlePatient")
                    : t("createSubtitleStaff")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            {serverError && (
              <div className="flex items-start gap-2 rounded-[var(--radius-input)] border border-destructive/30 bg-accent-red-soft p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {isPatient || !context.canCreateNewPatient ? (
              existingFormBody
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(val) => {
                  setServerError(null);
                  setActiveTab(val as "existing" | "new");
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">
                    {tDialog("tabExisting")}
                  </TabsTrigger>
                  <TabsTrigger value="new">{tDialog("tabNew")}</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-4">
                  {existingFormBody}
                </TabsContent>

                <TabsContent value="new" className="mt-4">
                  <Form {...newPatientForm}>
                    <form
                      onSubmit={newPatientForm.handleSubmit((data) => {
                        setServerError(null);
                        registerMutation.mutate(data);
                      })}
                      className="space-y-5"
                    >
                      <div className="space-y-3 rounded-[var(--radius-card)] border border-hairline bg-canvas-soft/60 p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {tDialog("patientDetailsTitle")}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={newPatientForm.control}
                            name="patient.first_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {tDialog("firstNameLabel")}{" "}
                                  <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={tDialog(
                                      "firstNamePlaceholder",
                                    )}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={newPatientForm.control}
                            name="patient.last_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {tDialog("lastNameLabel")}{" "}
                                  <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={tDialog("lastNamePlaceholder")}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={newPatientForm.control}
                            name="patient.email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {tDialog("emailLabel")}{" "}
                                  <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    dir="ltr"
                                    placeholder={tDialog("emailPlaceholder")}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={newPatientForm.control}
                            name="patient.phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{tDialog("phoneLabel")}</FormLabel>
                                <FormControl>
                                  <Input
                                    dir="ltr"
                                    placeholder="+20 100..."
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={newPatientForm.control}
                            name="patient.gender"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{tDialog("genderLabel")}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue
                                        placeholder={tDialog("selectGender")}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="male">
                                      {tGender("male")}
                                    </SelectItem>
                                    <SelectItem value="female">
                                      {tGender("female")}
                                    </SelectItem>
                                    <SelectItem value="other">
                                      {tGender("other")}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={newPatientForm.control}
                            name="patient.date_of_birth"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>{tDialog("dobLabel")}</FormLabel>
                                <DatePicker
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder={tDialog("pickDate")}
                                  captionLayout="dropdown"
                                  fromYear={1900}
                                  toYear={new Date().getFullYear()}
                                  disabledDates={(d) =>
                                    d > new Date() || d < new Date("1900-01-01")
                                  }
                                  clearable
                                  clearLabel={tCommon("clear")}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="space-y-4 border-t border-hairline pt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {tDialog("appointmentDetailsTitle")}
                        </h3>

                        <FormField
                          control={newPatientForm.control}
                          name="appointment.doctor_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("doctorLabel")}{" "}
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isDoctor}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={t("selectDoctor")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {renderDoctorSelectItems()}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <DoctorScheduleSummary doctor={selectedNewDoctor} />

                        <FormField
                          control={newPatientForm.control}
                          name="appointment.appointment_date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <FormLabel>
                                  {t("dateLabel")}{" "}
                                  <span className="text-destructive">*</span>
                                </FormLabel>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    disabled={makeDisabledDateCheck(
                                      selectedNewDoctor,
                                    )(todayStart)}
                                    onClick={() =>
                                      applyDayToField(
                                        todayStart,
                                        field.value,
                                        selectedNewDoctor,
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
                                    className="h-7 px-2 text-xs"
                                    disabled={makeDisabledDateCheck(
                                      selectedNewDoctor,
                                    )(tomorrowStart)}
                                    onClick={() =>
                                      applyDayToField(
                                        tomorrowStart,
                                        field.value,
                                        selectedNewDoctor,
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
                                    selectedNewDoctor,
                                    field.onChange,
                                  )
                                }
                                placeholder={t("pickDate")}
                                dateFormat="PPPp"
                                disabledDates={makeDisabledDateCheck(
                                  selectedNewDoctor,
                                )}
                              />

                              <TimeSlotPicker
                                doctorId={watchedNewDoctorId}
                                doctor={selectedNewDoctor}
                                date={watchedNewDate}
                                value={field.value}
                                onChange={field.onChange}
                                allowCustomTime
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={newPatientForm.control}
                          name="appointment.notes"
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
                      </div>

                      <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => onOpenChange(false)}
                        >
                          {t("btnCancel")}
                        </Button>
                        <Button
                          type="submit"
                          className="w-full sm:w-auto"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending && (
                            <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          )}
                          {tDialog("registerAndBook")}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </>
  );
}
