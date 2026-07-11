"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  prescriptionFormSchema,
  type PrescriptionFormData,
} from "@/types/prescription.types";
import {
  createPrescription,
  updatePrescription,
} from "@/app/actions/prescription";
import { MedicationCombobox } from "./medication-combobox";
import { PatientCombobox } from "./patient-combobox";

interface PrescriptionItemRecord {
  medication_id: string | null;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity: number | null;
  instructions: string | null;
}

export interface PrescriptionRecord {
  id: string;
  patient_id: string;
  diagnosis: string | null;
  notes: string | null;
  status: string;
  prescription_items: PrescriptionItemRecord[];
}

interface PrescriptionFormProps {
  /** When set, the form prescribes for this patient and hides the picker. */
  patientId?: string;
  /** When set, the form edits an existing prescription. */
  prescription?: PrescriptionRecord | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

const EMPTY_ITEM: PrescriptionFormData["items"][number] = {
  medication_id: null,
  medication_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  route: "",
  instructions: "",
};

function toDefaultValues(
  patientId: string | undefined,
  prescription: PrescriptionRecord | null | undefined,
): PrescriptionFormData {
  if (prescription) {
    return {
      patient_id: prescription.patient_id,
      diagnosis: prescription.diagnosis ?? "",
      notes: prescription.notes ?? "",
      status: (prescription.status as PrescriptionFormData["status"]) ?? "active",
      items: prescription.prescription_items.map((item) => ({
        medication_id: item.medication_id,
        medication_name: item.medication_name,
        dosage: item.dosage ?? "",
        frequency: item.frequency ?? "",
        duration: item.duration ?? "",
        route: item.route ?? "",
        quantity: item.quantity ?? undefined,
        instructions: item.instructions ?? "",
      })),
    };
  }

  return {
    patient_id: patientId ?? "",
    diagnosis: "",
    notes: "",
    status: "active",
    items: [{ ...EMPTY_ITEM }],
  };
}

export function PrescriptionForm({
  patientId,
  prescription,
  onSuccess,
  onCancel,
}: PrescriptionFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionFormSchema) as any,
    defaultValues: toDefaultValues(patientId, prescription),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const itemErrors = form.formState.errors.items;

  function onSubmit(data: PrescriptionFormData) {
    startTransition(async () => {
      const result = prescription
        ? await updatePrescription(prescription.id, data)
        : await createPrescription(data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        prescription ? "Prescription updated" : "Prescription created",
      );
      form.reset(toDefaultValues(patientId, null));
      onSuccess();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {!patientId && (
          <FormField
            control={form.control}
            name="patient_id"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Patient</FormLabel>
                <PatientCombobox
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="diagnosis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Diagnosis</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Acute Pharyngitis"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Medication line-items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel className="text-sm font-medium">Medications</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...EMPTY_ITEM })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add drug
            </Button>
          </div>

          {typeof itemErrors?.message === "string" && (
            <p className="text-xs text-destructive">{itemErrors.message}</p>
          )}

          {fields.map((fieldItem, index) => (
            <div
              key={fieldItem.id}
              className="space-y-3 rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.medication_name`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs text-muted-foreground">
                        Medication
                      </FormLabel>
                      <MedicationCombobox
                        value={field.value}
                        onChange={({ name, medicationId }) => {
                          field.onChange(name);
                          form.setValue(
                            `items.${index}.medication_id`,
                            medicationId,
                          );
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5 text-muted-foreground hover:text-destructive"
                  onClick={() => (fields.length > 1 ? remove(index) : null)}
                  disabled={fields.length === 1}
                  aria-label="Remove medication"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Input
                  placeholder="Dosage (500mg)"
                  {...form.register(`items.${index}.dosage`)}
                />
                <Input
                  placeholder="Frequency (2x/day)"
                  {...form.register(`items.${index}.frequency`)}
                />
                <Input
                  placeholder="Duration (7 days)"
                  {...form.register(`items.${index}.duration`)}
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  {...form.register(`items.${index}.quantity`)}
                />
              </div>

              <Textarea
                placeholder="Instructions (e.g., take after meals)"
                className="min-h-[60px]"
                {...form.register(`items.${index}.instructions`)}
              />
            </div>
          ))}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes for this prescription..."
                  className="min-h-[60px]"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 border-t pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {prescription ? "Save changes" : "Create prescription"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
