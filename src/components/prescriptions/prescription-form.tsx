"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { buildPrescriptionDefaultsFromMedicine } from "@/types/medication.types";
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
import { useTranslations } from "next-intl";

interface PrescriptionItemRecord {
  medication_id: string | null;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity: number | null;
  instructions: string | null;
  is_stopped?: boolean;
}

export interface PrescriptionRecord {
  id: string;
  patient_id: string;
  patient_name?: string;
  doctor_name?: string | null;
  issued_at?: string | Date;
  diagnosis: string | null;
  notes: string | null;
  status: string;
  prescription_items: PrescriptionItemRecord[];
}

interface PrescriptionFormProps {
  /** When set, the form prescribes for this patient and hides the picker. */
  patientId?: string;
  /** When set, the form edits or views an existing prescription. */
  prescription?: PrescriptionRecord | null;
  /** When true, every field is disabled and mutations are suppressed. */
  readOnly?: boolean;
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
  is_legacy: false,
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
        is_legacy: item.medication_id === null,
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
  readOnly = false,
  onSuccess,
  onCancel,
}: PrescriptionFormProps) {
  const t = useTranslations("prescriptions.form");
  const tStatus = useTranslations("enums.status");
  const [isPending, startTransition] = useTransition();

  const form = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionFormSchema) as any,
    defaultValues: toDefaultValues(patientId, prescription),
  });

  useEffect(() => {
    form.reset(toDefaultValues(patientId, prescription));
  }, [patientId, prescription, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const itemErrors = form.formState.errors.items;

  function onSubmit(data: PrescriptionFormData) {
    if (readOnly) return;
    startTransition(async () => {
      const result = prescription
        ? await updatePrescription(prescription.id, data)
        : await createPrescription(data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        prescription ? t("toastUpdated") : t("toastCreated"),
      );
      form.reset(toDefaultValues(patientId, null));
      onSuccess();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {readOnly && prescription && (prescription.issued_at || prescription.doctor_name) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {prescription.issued_at && (
              <span>
                {t("issuedOn")}:{" "}
                <strong className="font-medium text-foreground">
                  {format(new Date(prescription.issued_at), "MMM d, yyyy")}
                </strong>
              </span>
            )}
            {prescription.doctor_name && (
              <span>
                {t("prescribedBy")}:{" "}
                <strong className="font-medium text-foreground">
                  {prescription.doctor_name}
                </strong>
              </span>
            )}
          </div>
        )}

        {!patientId && (
          <FormField
            control={form.control}
            name="patient_id"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t("patientLabel")}</FormLabel>
                <PatientCombobox
                  value={field.value}
                  initialLabel={prescription?.patient_name}
                  disabled={readOnly}
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
                <FormLabel>{t("diagnosisLabel")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("diagnosisPlaceholder")}
                    disabled={readOnly}
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
                <FormLabel>{t("statusLabel")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={readOnly}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("statusPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">{tStatus("active")}</SelectItem>
                    <SelectItem value="completed">{tStatus("completed")}</SelectItem>
                    <SelectItem value="cancelled">{tStatus("cancelled")}</SelectItem>
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
            <FormLabel className="text-sm font-medium">{t("medicationsLabel")}</FormLabel>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...EMPTY_ITEM })}
              >
                <Plus className="me-1 h-4 w-4" />
                {t("addDrug")}
              </Button>
            )}
          </div>

          {typeof itemErrors?.message === "string" && (
            <p className="text-xs text-destructive">{itemErrors.message}</p>
          )}

          {fields.map((fieldItem, index) => {
            const watchedId = form.watch(`items.${index}.medication_id`);
            const watchedLegacy = form.watch(`items.${index}.is_legacy`);
            const originalItem = prescription?.prescription_items[index];
            const isStoppedHistorical =
              Boolean(originalItem?.is_stopped) &&
              originalItem?.medication_id === watchedId;

            return (
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
                        <div className="flex items-center gap-2">
                          <FormLabel className="text-xs text-muted-foreground">
                            {t("medicationLabel")}
                          </FormLabel>
                          {watchedLegacy && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              {t("legacyBadge")}
                            </Badge>
                          )}
                          {isStoppedHistorical && (
                            <Badge
                              variant="secondary"
                              className="bg-accent-red-soft text-accent-red px-1.5 py-0 text-[10px]"
                            >
                              {t("stoppedBadge")}
                            </Badge>
                          )}
                        </div>
                        <MedicationCombobox
                          value={field.value}
                          selectedId={watchedId}
                          disabled={readOnly}
                          onChange={({ medicine }) => {
                            const defaults =
                              buildPrescriptionDefaultsFromMedicine(medicine);
                            field.onChange(defaults.medication_name);
                            form.setValue(
                              `items.${index}.medication_id`,
                              defaults.medication_id,
                              { shouldDirty: true, shouldValidate: true },
                            );
                            form.setValue(
                              `items.${index}.is_legacy`,
                              false,
                              { shouldDirty: true },
                            );
                            form.setValue(
                              `items.${index}.dosage`,
                              defaults.dosage,
                              { shouldDirty: true },
                            );
                            form.setValue(
                              `items.${index}.frequency`,
                              defaults.frequency,
                              { shouldDirty: true },
                            );
                            form.setValue(
                              `items.${index}.duration`,
                              defaults.duration,
                              { shouldDirty: true },
                            );
                            form.setValue(
                              `items.${index}.route`,
                              defaults.route,
                              { shouldDirty: true },
                            );
                            form.setValue(
                              `items.${index}.quantity`,
                              defaults.quantity,
                              { shouldDirty: true },
                            );
                            form.setValue(
                              `items.${index}.instructions`,
                              defaults.instructions,
                              { shouldDirty: true },
                            );
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-5 text-muted-foreground hover:text-destructive"
                      onClick={() => (fields.length > 1 ? remove(index) : null)}
                      disabled={fields.length === 1}
                      aria-label={t("removeMedication")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Input
                    placeholder={t("dosagePlaceholder")}
                    disabled={readOnly}
                    {...form.register(`items.${index}.dosage`)}
                  />
                  <Input
                    placeholder={t("frequencyPlaceholder")}
                    disabled={readOnly}
                    {...form.register(`items.${index}.frequency`)}
                  />
                  <Input
                    placeholder={t("durationPlaceholder")}
                    disabled={readOnly}
                    {...form.register(`items.${index}.duration`)}
                  />
                  <Input
                    placeholder={t("routePlaceholder")}
                    disabled={readOnly}
                    {...form.register(`items.${index}.route`)}
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder={t("qtyPlaceholder")}
                    disabled={readOnly}
                    {...form.register(`items.${index}.quantity`)}
                  />
                </div>

                <Textarea
                  placeholder={t("instructionsPlaceholder")}
                  className="min-h-[60px]"
                  disabled={readOnly}
                  {...form.register(`items.${index}.instructions`)}
                />
              </div>
            );
          })}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("notesLabel")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("notesPlaceholder")}
                  className="min-h-[60px]"
                  disabled={readOnly}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 border-t pt-4">
          {readOnly ? (
            onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("close")}
              </Button>
            )
          ) : (
            <>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  {t("cancel")}
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {prescription ? t("saveChanges") : t("createPrescription")}
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  );
}
