"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clinicMedicineSchema,
  MEDICINE_CATEGORIES,
  MEDICINE_FORMS,
  MEDICINE_ROUTES,
  type ClinicMedicineFormData,
  type ClinicMedicineRecord,
} from "@/types/medication.types";
import {
  createClinicMedicine,
  updateClinicMedicine,
} from "@/app/actions/medicine";

interface MedicineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit" | "view";
  medicine?: ClinicMedicineRecord | null;
  initialGenericName?: string;
  onSaved?: (medicine: ClinicMedicineRecord) => void;
}

const NONE_OPTION = "__none__";

function hasPharmacyDetails(medicine?: ClinicMedicineRecord | null): boolean {
  if (!medicine) return false;
  return Boolean(
    medicine.manufacturer ||
      medicine.price !== null ||
      medicine.barcode ||
      medicine.code ||
      medicine.code_system,
  );
}

function toDefaultValues(
  medicine?: ClinicMedicineRecord | null,
  initialGenericName?: string,
): ClinicMedicineFormData {
  if (medicine) {
    return {
      generic_name: medicine.generic_name,
      brand_name: medicine.brand_name ?? "",
      category: medicine.category ?? "",
      strength: medicine.strength ?? "",
      form: medicine.form ?? "",
      route: medicine.route ?? "",
      default_dosage: medicine.default_dosage ?? "",
      default_frequency: medicine.default_frequency ?? "",
      default_duration: medicine.default_duration ?? "",
      default_quantity: medicine.default_quantity ?? null,
      default_instructions: medicine.default_instructions ?? "",
      manufacturer: medicine.manufacturer ?? "",
      price: medicine.price ?? null,
      barcode: medicine.barcode ?? "",
      code: medicine.code ?? "",
      code_system: medicine.code_system ?? "",
    };
  }

  return {
    generic_name: initialGenericName ?? "",
    brand_name: "",
    category: "",
    strength: "",
    form: "",
    route: "",
    default_dosage: "",
    default_frequency: "",
    default_duration: "",
    default_quantity: null,
    default_instructions: "",
    manufacturer: "",
    price: null,
    barcode: "",
    code: "",
    code_system: "",
  };
}

export function MedicineFormDialog({
  open,
  onOpenChange,
  mode,
  medicine,
  initialGenericName,
  onSaved,
}: MedicineFormDialogProps) {
  const t = useTranslations("medicines");
  const [isPending, startTransition] = useTransition();
  const [showPharmacy, setShowPharmacy] = useState(() =>
    hasPharmacyDetails(medicine),
  );
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const form = useForm<ClinicMedicineFormData>({
    resolver: zodResolver(clinicMedicineSchema) as any,
    defaultValues: toDefaultValues(medicine, initialGenericName),
  });

  useEffect(() => {
    if (open) {
      form.reset(toDefaultValues(medicine, initialGenericName));
      setShowPharmacy(hasPharmacyDetails(medicine));
    }
  }, [open, medicine, initialGenericName, form]);

  function onSubmit(data: ClinicMedicineFormData) {
    if (isView) return;
    startTransition(async () => {
      const result =
        isEdit && medicine
          ? await updateClinicMedicine(medicine.id, data)
          : await createClinicMedicine(data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? t("toastUpdated") : t("toastCreated"));
      onSaved?.(result.data);
      onOpenChange(false);
    });
  }

  const title = isView
    ? t("dialog.viewTitle")
    : isEdit
      ? t("dialog.editTitle")
      : t("dialog.createTitle");
  const description = isView
    ? t("dialog.viewDescription")
    : isEdit
      ? t("dialog.editDescription")
      : t("dialog.createDescription");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isView && medicine && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>{t("statusLabel")}:</span>
                <StatusBadge status={medicine.is_active ? "active" : "stopped"} />
              </div>
              {medicine.created_by_name && (
                <span>
                  {t("addedBy")}:{" "}
                  <strong className="font-medium text-foreground">
                    {medicine.created_by_name}
                  </strong>
                </span>
              )}
            </div>
            {!medicine.is_active && (
              <div className="space-y-1 border-t border-border/50 pt-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {medicine.stopped_at && (
                    <span>
                      {t("stoppedOn")}:{" "}
                      <strong className="font-medium text-foreground">
                        {format(new Date(medicine.stopped_at), "MMM d, yyyy")}
                      </strong>
                    </span>
                  )}
                  {medicine.stopped_by_name && (
                    <span>
                      {t("stoppedBy")}:{" "}
                      <strong className="font-medium text-foreground">
                        {medicine.stopped_by_name}
                      </strong>
                    </span>
                  )}
                </div>
                {medicine.stop_reason && (
                  <p>
                    {t("stopReasonLabel")}:{" "}
                    <span className="text-foreground">{medicine.stop_reason}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Section 1: Core Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("sections.coreInfo")}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="generic_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.genericName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.genericName")}
                          disabled={isView}
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
                  name="brand_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.brandName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.brandName")}
                          disabled={isView}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.category")}</FormLabel>
                      <Select
                        disabled={isView}
                        value={field.value || NONE_OPTION}
                        onValueChange={(val) =>
                          field.onChange(val === NONE_OPTION ? "" : val)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("placeholders.category")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_OPTION}>
                            {t("placeholders.none")}
                          </SelectItem>
                          {MEDICINE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {t(`categories.${cat}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="strength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.strength")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.strength")}
                          disabled={isView}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="form"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.form")}</FormLabel>
                      <Select
                        disabled={isView}
                        value={field.value || NONE_OPTION}
                        onValueChange={(val) =>
                          field.onChange(val === NONE_OPTION ? "" : val)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("placeholders.form")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_OPTION}>
                            {t("placeholders.none")}
                          </SelectItem>
                          {MEDICINE_FORMS.map((f) => (
                            <SelectItem key={f} value={f}>
                              {t(`forms.${f}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="route"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.route")}</FormLabel>
                      <Select
                        disabled={isView}
                        value={field.value || NONE_OPTION}
                        onValueChange={(val) =>
                          field.onChange(val === NONE_OPTION ? "" : val)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("placeholders.route")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_OPTION}>
                            {t("placeholders.none")}
                          </SelectItem>
                          {MEDICINE_ROUTES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {t(`routes.${r}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 2: Prescribing Defaults */}
            <div className="space-y-3 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t("sections.prescribingDefaults")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("sections.prescribingDefaultsHint")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="default_dosage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.defaultDosage")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.defaultDosage")}
                          disabled={isView}
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
                  name="default_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.defaultFrequency")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.defaultFrequency")}
                          disabled={isView}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="default_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.defaultDuration")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.defaultDuration")}
                          disabled={isView}
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
                  name="default_quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.defaultQuantity")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder={t("placeholders.defaultQuantity")}
                          disabled={isView}
                          value={
                            field.value === null || field.value === undefined
                              ? ""
                              : String(field.value)
                          }
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="default_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.defaultInstructions")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("placeholders.defaultInstructions")}
                        className="min-h-[60px]"
                        disabled={isView}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Section 3: Collapsible Optional / Pharmacy Details */}
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex w-full items-center justify-between px-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                onClick={() => setShowPharmacy((prev) => !prev)}
              >
                <span>{t("sections.optionalDetails")}</span>
                {showPharmacy ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showPharmacy && (
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.manufacturer")}</FormLabel>
                          <FormControl>
                            <Input
                              disabled={isView}
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
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.price")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              disabled={isView}
                              value={
                                field.value === null || field.value === undefined
                                  ? ""
                                  : String(field.value)
                              }
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.barcode")}</FormLabel>
                          <FormControl>
                            <Input
                              disabled={isView}
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
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.code")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="RxNorm / ATC"
                              disabled={isView}
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
                      name="code_system"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.codeSystem")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="RxNorm"
                              disabled={isView}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              {isView ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {t("actions.close")}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending && (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    )}
                    {isEdit ? t("actions.save") : t("actions.create")}
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
