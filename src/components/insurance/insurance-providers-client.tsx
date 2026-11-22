"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  FlaskConical,
  Pencil,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createInsuranceProvider,
  deleteInsuranceProvider,
  getInsuranceProviders,
  updateInsuranceProvider,
} from "@/app/actions/insurance";
import {
  insuranceProviderSchema,
  type DeductionType,
  type InsuranceProviderData,
  type InsuranceProviderRow,
} from "@/types/insurance.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "next-intl";

function formatRuleShort(
  type: DeductionType | null | undefined,
  value: number | null | undefined,
  fallbackType: DeductionType,
): string | null {
  if (value === null || value === undefined) return null;
  const resolvedType = type ?? fallbackType;
  return resolvedType === "fixed"
    ? `$${Number(value).toFixed(2)}`
    : `${Number(value)}%`;
}

function deductionLabel(row: InsuranceProviderRow): string {
  return row.deduction_type === "fixed"
    ? `$${row.deduction_value.toFixed(2)} / visit`
    : `${row.deduction_value}% of invoice`;
}

const emptyForm: InsuranceProviderData = {
  name: "",
  contact_email: "",
  contact_phone: "",
  deduction_type: "fixed",
  deduction_value: 0,
  consultation_deduction_type: "percentage",
  consultation_deduction_value: null,
  lab_deduction_type: "percentage",
  lab_deduction_value: null,
  pharmacy_deduction_type: "percentage",
  pharmacy_deduction_value: null,
  covered_visits: null,
  is_active: true,
};

export function InsuranceProvidersClient() {
  const t = useTranslations("insurance.providers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceProviderRow | null>(null);
  const [deleting, setDeleting] = useState<InsuranceProviderRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const { data: providers = [], refetch } = useQuery({
    queryKey: ["insurance-providers"],
    queryFn: () => getInsuranceProviders(),
  });

  const form = useForm<InsuranceProviderData>({
    resolver: zodResolver(
      insuranceProviderSchema,
    ) as Resolver<InsuranceProviderData>,
    defaultValues: emptyForm,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: InsuranceProviderRow) => {
    setEditing(row);
    form.reset({
      name: row.name,
      contact_email: row.contact_email ?? "",
      contact_phone: row.contact_phone ?? "",
      deduction_type: row.deduction_type,
      deduction_value: row.deduction_value,
      consultation_deduction_type:
        row.consultation_deduction_type ?? row.deduction_type,
      consultation_deduction_value: row.consultation_deduction_value ?? null,
      lab_deduction_type: row.lab_deduction_type ?? row.deduction_type,
      lab_deduction_value: row.lab_deduction_value ?? null,
      pharmacy_deduction_type:
        row.pharmacy_deduction_type ?? row.deduction_type,
      pharmacy_deduction_value: row.pharmacy_deduction_value ?? null,
      covered_visits: row.covered_visits,
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: InsuranceProviderData) => {
    startTransition(async () => {
      const result = editing
        ? await updateInsuranceProvider(editing.id, data)
        : await createInsuranceProvider(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        editing ? t("toastUpdated") : t("toastAdded"),
      );
      setDialogOpen(false);
      refetch();
    });
  };

  const onDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteInsuranceProvider(deleting.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("toastRemoved"));
        refetch();
      }
      setDeleting(null);
    });
  };

  const formatDeductionLabel = (row: InsuranceProviderRow): string =>
    row.deduction_type === "fixed"
      ? t("perVisit", { amount: row.deduction_value.toFixed(2) })
      : t("percentOfInvoice", { percent: row.deduction_value });

  const columns: ColumnDef<InsuranceProviderRow>[] = [
    {
      accessorKey: "name",
      header: t("colCompany"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.contact_email ||
                row.original.contact_phone ||
                t("noContact")}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "deduction",
      header: t("colDeductionRules"),
      cell: ({ row }) => {
        const r = row.original;
        const consultLabel = formatRuleShort(
          r.consultation_deduction_type,
          r.consultation_deduction_value,
          r.deduction_type,
        );
        const labLabel = formatRuleShort(
          r.lab_deduction_type,
          r.lab_deduction_value,
          r.deduction_type,
        );
        const pharmLabel = formatRuleShort(
          r.pharmacy_deduction_type,
          r.pharmacy_deduction_value,
          r.deduction_type,
        );

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-normal">
              {t("badgeDefault", { rule: formatDeductionLabel(r) })}
            </Badge>
            {consultLabel && (
              <Badge variant="outline" className="text-xs font-normal">
                {t("badgeConsultation", { value: consultLabel })}
              </Badge>
            )}
            {labLabel && (
              <Badge variant="outline" className="text-xs font-normal">
                {t("badgeLab", { value: labLabel })}
              </Badge>
            )}
            {pharmLabel && (
              <Badge variant="outline" className="text-xs font-normal">
                {t("badgePharmacy", { value: pharmLabel })}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "covered_visits",
      header: t("colCoveredVisits"),
      cell: ({ row }) =>
        row.original.covered_visits === null
          ? t("unlimited")
          : row.original.covered_visits,
    },
    {
      accessorKey: "patients_count",
      header: t("colPatients"),
      cell: ({ row }) => row.original.patients_count,
    },
    {
      accessorKey: "is_active",
      header: t("colStatus"),
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "outline"}>
          {row.original.is_active ? t("active") : t("inactive")}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: t("colAdded"),
      cell: ({ row }) =>
        format(new Date(row.original.created_at), "MMM d, yyyy"),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={t("ariaEditCompany")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleting(row.original)}
            aria-label={t("ariaDeleteCompany")}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const deductionType = form.watch("deduction_type");
  const consultType =
    form.watch("consultation_deduction_type") ?? deductionType;
  const labType = form.watch("lab_deduction_type") ?? deductionType;
  const pharmType = form.watch("pharmacy_deduction_type") ?? deductionType;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          {t("addCompany")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={providers}
        searchKey="name"
        searchPlaceholder={t("searchPlaceholder")}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editCompanyTitle") : t("addCompanyTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("companyNameLabel")}</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder={t("companyNamePlaceholder")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email">{t("contactEmailLabel")}</Label>
                <Input
                  id="contact_email"
                  type="email"
                  {...form.register("contact_email")}
                  placeholder="claims@medcare.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">{t("contactPhoneLabel")}</Label>
                <Input
                  id="contact_phone"
                  {...form.register("contact_phone")}
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>

            <Separator />

            {/* Default Deduction Rule */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">
                {t("defaultRuleTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("defaultRuleDesc")}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("deductionTypeLabel")}</Label>
                  <Select
                    value={deductionType}
                    onValueChange={(v) =>
                      form.setValue(
                        "deduction_type",
                        v as "fixed" | "percentage",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">
                        {t("typeFixedFull")}
                      </SelectItem>
                      <SelectItem value="percentage">
                        {t("typePercentageFull")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deduction_value">
                    {deductionType === "fixed"
                      ? t("defaultAmountLabel")
                      : t("defaultPercentLabel")}
                  </Label>
                  <Input
                    id="deduction_value"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("deduction_value")}
                  />
                  {form.formState.errors.deduction_value && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.deduction_value.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Category-Specific Overrides */}
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">
                  {t("categoryOverridesTitle")}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t("categoryOverridesDesc")}
                </p>
              </div>

              {/* Consultation */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Stethoscope className="h-4 w-4 text-sky-600" />
                  <span>{t("consultationDeduction")}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("typeLabel")}</Label>
                    <Select
                      value={consultType}
                      onValueChange={(v) =>
                        form.setValue(
                          "consultation_deduction_type",
                          v as "fixed" | "percentage",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">{t("typeFixedShort")}</SelectItem>
                        <SelectItem value="percentage">
                          {t("typePercentageShort")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="consultation_deduction_value"
                      className="text-xs"
                    >
                      {consultType === "fixed"
                        ? t("consultationAmountLabel")
                        : t("consultationCoverageLabel")}
                    </Label>
                    <Input
                      id="consultation_deduction_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t("useDefaultRule")}
                      {...form.register("consultation_deduction_value", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    {form.formState.errors.consultation_deduction_value && (
                      <p className="text-xs text-destructive">
                        {
                          form.formState.errors.consultation_deduction_value
                            .message
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Lab */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FlaskConical className="h-4 w-4 text-amber-600" />
                  <span>{t("labDeduction")}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("typeLabel")}</Label>
                    <Select
                      value={labType}
                      onValueChange={(v) =>
                        form.setValue(
                          "lab_deduction_type",
                          v as "fixed" | "percentage",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">{t("typeFixedShort")}</SelectItem>
                        <SelectItem value="percentage">
                          {t("typePercentageShort")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lab_deduction_value" className="text-xs">
                      {labType === "fixed"
                        ? t("labAmountLabel")
                        : t("labCoverageLabel")}
                    </Label>
                    <Input
                      id="lab_deduction_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t("useDefaultRule")}
                      {...form.register("lab_deduction_value", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    {form.formState.errors.lab_deduction_value && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.lab_deduction_value.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pharmacy */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Pill className="h-4 w-4 text-emerald-600" />
                  <span>{t("pharmacyDeduction")}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("typeLabel")}</Label>
                    <Select
                      value={pharmType}
                      onValueChange={(v) =>
                        form.setValue(
                          "pharmacy_deduction_type",
                          v as "fixed" | "percentage",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">{t("typeFixedShort")}</SelectItem>
                        <SelectItem value="percentage">
                          {t("typePercentageShort")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="pharmacy_deduction_value"
                      className="text-xs"
                    >
                      {pharmType === "fixed"
                        ? t("pharmacyAmountLabel")
                        : t("pharmacyCoverageLabel")}
                    </Label>
                    <Input
                      id="pharmacy_deduction_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t("useDefaultRule")}
                      {...form.register("pharmacy_deduction_value", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    {form.formState.errors.pharmacy_deduction_value && (
                      <p className="text-xs text-destructive">
                        {
                          form.formState.errors.pharmacy_deduction_value
                            .message
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="covered_visits">{t("colCoveredVisits")}</Label>
                <Input
                  id="covered_visits"
                  type="number"
                  min="1"
                  placeholder={t("unlimited")}
                  {...form.register("covered_visits", {
                    setValueAs: (v) =>
                      v === "" || v === null ? null : Number(v),
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("coveredVisitsHint")}
                </p>
                {form.formState.errors.covered_visits && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.covered_visits.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_active">{t("active")}</Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="is_active"
                    checked={form.watch("is_active")}
                    onCheckedChange={(v) => form.setValue("is_active", v)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? t("saving")
                  : editing
                    ? t("saveChanges")
                    : t("addCompany")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle", { name: deleting?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={isPending}>
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
