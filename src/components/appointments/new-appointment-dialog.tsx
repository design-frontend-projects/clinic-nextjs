"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";

import {
  createAppointment,
  searchPatients,
  registerPatientAndCreateAppointment,
  getDoctors,
} from "@/app/actions/admin";
import {
  appointmentFormSchema,
  createAppointmentWithPatientSchema,
  type AppointmentFormData,
  type CreateAppointmentWithPatientData,
} from "@/types/appointment.types";

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
}: NewAppointmentDialogProps) {
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tempPasswordInfo, setTempPasswordInfo] =
    useState<TempPasswordInfo | null>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => getDoctors(),
  });

  const { data: patientSearchResults = [], isLoading: isSearchingPatients } = useQuery({
    queryKey: ["patientsSearch", patientSearchQuery],
    queryFn: () => searchPatients(patientSearchQuery),
    enabled: patientSearchQuery.length >= 2,
  });

  // Forms
  const existingPatientForm = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema) as any,
    defaultValues: {
      patient_id: "",
      doctor_id: "",
      status: "scheduled",
      notes: "",
    },
  });

  const newPatientForm = useForm<CreateAppointmentWithPatientData>({
    resolver: zodResolver(createAppointmentWithPatientSchema) as any,
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
        doctor_id: "",
        status: "scheduled",
        notes: "",
      },
    },
  });

  // Mutations
  const createAppointmentMutation = useMutation({
    mutationFn: (data: AppointmentFormData) => createAppointment({
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      appointment_date: data.appointment_date.toISOString(),
      notes: data.notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
      existingPatientForm.reset();
    },
  });

  const registerPatientMutation = useMutation({
    mutationFn: (data: CreateAppointmentWithPatientData) => 
      registerPatientAndCreateAppointment(data),
    onSuccess: (result, variables) => {
      if (result.error) {
        newPatientForm.setError("root", { message: result.error });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      onOpenChange(false);
      newPatientForm.reset();
      if (result.tempPassword) {
        setTempPasswordInfo({
          tempPassword: result.tempPassword,
          fullName: `${variables.patient.first_name} ${variables.patient.last_name}`.trim(),
          email: variables.patient.email,
        });
      }
    },
  });

  function onExistingPatientSubmit(data: AppointmentFormData) {
    createAppointmentMutation.mutate(data);
  }

  function onNewPatientSubmit(data: CreateAppointmentWithPatientData) {
    registerPatientMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>
            Book an appointment for an existing patient or register a new one.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "existing" | "new")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Patient</TabsTrigger>
            <TabsTrigger value="new">New Patient</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-4">
            <Form {...existingPatientForm}>
              <form
                onSubmit={existingPatientForm.handleSubmit(onExistingPatientSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={existingPatientForm.control}
                  name="patient_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Patient</FormLabel>
                      <Popover
                        open={isPatientDropdownOpen}
                        onOpenChange={setIsPatientDropdownOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? patientSearchResults.find(
                                    (patient) => patient.id === field.value
                                  )?.first_name +
                                  " " +
                                  patientSearchResults.find(
                                    (patient) => patient.id === field.value
                                  )?.last_name || "Patient selected"
                                : "Select patient"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search patients..."
                              value={patientSearchQuery}
                              onValueChange={setPatientSearchQuery}
                            />
                            <CommandList>
                              {patientSearchResults.length === 0 &&
                              patientSearchQuery.length >= 2 &&
                              !isSearchingPatients ? (
                                <CommandEmpty>No patients found.</CommandEmpty>
                              ) : null}
                              {isSearchingPatients && (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                  Searching...
                                </div>
                              )}
                              <CommandGroup>
                                {patientSearchResults.map((patient) => (
                                  <CommandItem
                                    key={patient.id}
                                    value={patient.id}
                                    onSelect={() => {
                                      existingPatientForm.setValue(
                                        "patient_id",
                                        patient.id
                                      );
                                      setIsPatientDropdownOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        patient.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {patient.first_name} {patient.last_name}
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {patient.phone || patient.email}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={existingPatientForm.control}
                    name="doctor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doctor</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a doctor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                {doctor.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={existingPatientForm.control}
                    name="appointment_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date & Time</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPp")
                                ) : (
                                  <span>Pick a date and time</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                if (date) {
                                  // Maintain time if already set
                                  const newDate = new Date(date);
                                  if (field.value) {
                                    newDate.setHours(field.value.getHours());
                                    newDate.setMinutes(field.value.getMinutes());
                                  } else {
                                    // Default to 9 AM
                                    newDate.setHours(9, 0, 0, 0);
                                  }
                                  field.onChange(newDate);
                                } else {
                                  field.onChange(undefined);
                                }
                              }}
                              initialFocus
                            />
                            <div className="p-3 border-t border-border">
                              <Input
                                type="time"
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(":");
                                  const newDate = new Date(field.value || new Date());
                                  newDate.setHours(parseInt(hours), parseInt(minutes));
                                  field.onChange(newDate);
                                }}
                                value={
                                  field.value
                                    ? format(field.value, "HH:mm")
                                    : ""
                                }
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={existingPatientForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Reason for visit..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createAppointmentMutation.isPending}
                  >
                    {createAppointmentMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Appointment
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="new" className="mt-4">
            <Form {...newPatientForm}>
              <form
                onSubmit={newPatientForm.handleSubmit(onNewPatientSubmit)}
                className="space-y-6"
              >
                {newPatientForm.formState.errors.root && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    {newPatientForm.formState.errors.root.message}
                  </div>
                )}
                
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    Patient Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={newPatientForm.control}
                      name="patient.first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
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
                          <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={newPatientForm.control}
                      name="patient.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="john.doe@example.com" type="email" {...field} />
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
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={newPatientForm.control}
                      name="patient.gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
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
                          <FormLabel>Date of Birth</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
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

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    Appointment Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={newPatientForm.control}
                      name="appointment.doctor_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doctor <span className="text-destructive">*</span></FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a doctor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {doctors.map((doctor) => (
                                <SelectItem key={doctor.id} value={doctor.id}>
                                  {doctor.full_name}
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
                        <FormItem className="flex flex-col">
                          <FormLabel>Date & Time <span className="text-destructive">*</span></FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPp")
                                  ) : (
                                    <span>Pick a date and time</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  if (date) {
                                    // Maintain time if already set
                                    const newDate = new Date(date);
                                    if (field.value) {
                                      newDate.setHours(field.value.getHours());
                                      newDate.setMinutes(field.value.getMinutes());
                                    } else {
                                      // Default to 9 AM
                                      newDate.setHours(9, 0, 0, 0);
                                    }
                                    field.onChange(newDate);
                                  } else {
                                    field.onChange(undefined);
                                  }
                                }}
                                initialFocus
                              />
                              <div className="p-3 border-t border-border">
                                <Input
                                  type="time"
                                  onChange={(e) => {
                                    const [hours, minutes] = e.target.value.split(":");
                                    const newDate = new Date(field.value || new Date());
                                    newDate.setHours(parseInt(hours), parseInt(minutes));
                                    field.onChange(newDate);
                                  }}
                                  value={
                                    field.value
                                      ? format(field.value, "HH:mm")
                                      : ""
                                  }
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={newPatientForm.control}
                    name="appointment.notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Reason for visit..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerPatientMutation.isPending}
                  >
                    {registerPatientMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Register & Book
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </Dialog>
  );
}
