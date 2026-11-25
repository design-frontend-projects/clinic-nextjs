"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarIcon,
  Check,
  ChevronsUpDown,
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
import type { BookingContextData } from "@/types/booking.types";

import { TimeSlotPicker } from "@/components/bookings/time-slot-picker";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

interface BookingCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: BookingContextData;
}

export function BookingCreateDialog({
  open,
  onOpenChange,
  context,
}: BookingCreateDialogProps) {
  const t = useTranslations("pages.booking");
  const tDialog = useTranslations("appointments.newDialog");
  const tGender = useTranslations("enums.gender");
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
      existingForm.reset({
        patient_id: "",
        doctor_id: defaultDoctorId,
        branch_id: defaultBranchId,
        appointment_date: undefined,
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
          doctor_id: defaultDoctorId,
          status: "scheduled",
          notes: "",
        },
      });
      setSelectedPatientLabel("");
      setPatientQuery("");
    }
  }, [open, defaultDoctorId, defaultBranchId, existingForm, newPatientForm]);

  const { data: patientResults = [], isLoading: isSearchingPatients } = useQuery({
    queryKey: ["booking-patients-search", patientQuery],
    queryFn: () => searchBookingPatients(patientQuery),
    enabled: !isPatient && patientQuery.trim().length >= 2,
  });

  function invalidateAllBookingQueries() {
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookings });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookingSlots });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffAppointments });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffDashboard });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffQueue });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.doctor });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.admin });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.patientUpcoming });
    queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.patientHistory });
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
                  <PopoverContent className="w-[360px] p-0" align="start">
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
                            <CommandEmpty>{tDialog("noPatientsFound")}</CommandEmpty>
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
                                  existingForm.setValue("patient_id", patient.id, {
                                    shouldValidate: true,
                                  });
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
                  <SelectContent>
                    {context.doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.fullName}
                        {doctor.specialty ? ` — ${doctor.specialty}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
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

        <FormField
          control={existingForm.control}
          name="appointment_date"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-2">
              <FormLabel>{t("dateLabel")}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-start font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="me-2 h-4 w-4 opacity-60" />
                      {field.value ? format(field.value, "PPPp") : t("pickDate")}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    disabled={
                      isPatient
                        ? (d) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return d < today;
                          }
                        : undefined
                    }
                    onSelect={(selectedDay) => {
                      if (!selectedDay) return;
                      const next = new Date(selectedDay);
                      if (field.value) {
                        next.setHours(
                          field.value.getHours(),
                          field.value.getMinutes(),
                          0,
                          0,
                        );
                      } else {
                        next.setHours(9, 0, 0, 0);
                      }
                      field.onChange(next);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <TimeSlotPicker
                doctorId={watchedExistingDoctorId}
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

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("btnCancel")}
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
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
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-hairline bg-surface">
          <DialogHeader>
            <DialogTitle>
              {isPatient ? t("createTitlePatient") : t("createTitleStaff")}
            </DialogTitle>
            <DialogDescription>
              {isPatient
                ? t("createSubtitlePatient")
                : t("createSubtitleStaff")}
            </DialogDescription>
          </DialogHeader>

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
                <TabsTrigger value="existing">{tDialog("tabExisting")}</TabsTrigger>
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
                    <div className="space-y-3">
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
                                  placeholder={tDialog("firstNamePlaceholder")}
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
                                <Input placeholder="+20 100..." {...field} />
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
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-start font-normal",
                                        !field.value && "text-muted-foreground",
                                      )}
                                    >
                                      <CalendarIcon className="me-2 h-4 w-4 opacity-50" />
                                      {field.value
                                        ? format(field.value, "PPP")
                                        : tDialog("pickDate")}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(d) =>
                                      d > new Date() ||
                                      d < new Date("1900-01-01")
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
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
                                  <SelectValue placeholder={t("selectDoctor")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {context.doctors.map((doctor) => (
                                  <SelectItem key={doctor.id} value={doctor.id}>
                                    {doctor.fullName}
                                    {doctor.specialty
                                      ? ` — ${doctor.specialty}`
                                      : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={newPatientForm.control}
                        name="appointment.appointment_date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col space-y-2">
                            <FormLabel>
                              {t("dateLabel")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-start font-normal",
                                      !field.value && "text-muted-foreground",
                                    )}
                                  >
                                    <CalendarIcon className="me-2 h-4 w-4 opacity-50" />
                                    {field.value
                                      ? format(field.value, "PPPp")
                                      : t("pickDate")}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(selectedDay) => {
                                    if (!selectedDay) return;
                                    const next = new Date(selectedDay);
                                    if (field.value) {
                                      next.setHours(
                                        field.value.getHours(),
                                        field.value.getMinutes(),
                                        0,
                                        0,
                                      );
                                    } else {
                                      next.setHours(9, 0, 0, 0);
                                    }
                                    field.onChange(next);
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>

                            <TimeSlotPicker
                              doctorId={watchedNewDoctorId}
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

                    <div className="flex justify-end gap-2 border-t border-hairline pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                      >
                        {t("btnCancel")}
                      </Button>
                      <Button type="submit" disabled={registerMutation.isPending}>
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
        </DialogContent>
      </Dialog>

      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </>
  );
}
