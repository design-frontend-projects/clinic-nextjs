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
        editing ? "Insurance company updated." : "Insurance company added.",
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
        toast.success("Insurance company removed.");
        refetch();
      }
      setDeleting(null);
    });
  };

  const columns: ColumnDef<InsuranceProviderRow>[] = [
    {
      accessorKey: "name",
      header: "Company",
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
                "No contact"}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "deduction",
      header: "Deduction Rules (Default & Per Category)",
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
              Default: {deductionLabel(r)}
            </Badge>
            {consultLabel && (
              <Badge variant="outline" className="text-xs font-normal">
                Consultation: {consultLabel}
              </Badge>
            )}
            {labLabel && (
              <Badge variant="outline" className="text-xs font-normal">
                Lab: {labLabel}
              </Badge>
            )}
            {pharmLabel && (
              <Badge variant="outline" className="text-xs font-normal">
                Pharmacy: {pharmLabel}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "covered_visits",
      header: "Covered Visits",
      cell: ({ row }) =>
        row.original.covered_visits === null
          ? "Unlimited"
          : row.original.covered_visits,
    },
    {
      accessorKey: "patients_count",
      header: "Patients",
      cell: ({ row }) => row.original.patients_count,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "outline"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Added",
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
            aria-label="Edit company"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleting(row.original)}
            aria-label="Delete company"
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
            Insurance Companies
          </h1>
          <p className="text-muted-foreground">
            Define insurance companies and deduction rules per visit,
            consultation, lab, and pharmacy
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={providers}
        searchKey="name"
        searchPlaceholder="Search companies..."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Insurance Company" : "Add Insurance Company"}
            </DialogTitle>
            <DialogDescription>
              Set the company details, default deduction rule, and optional
              deduction overrides for Consultation, Lab, and Pharmacy.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="e.g. MedCare Insurance"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  {...form.register("contact_email")}
                  placeholder="claims@medcare.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
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
                Default / General Deduction Rule *
              </h4>
              <p className="text-xs text-muted-foreground">
                Applied to any invoice item whose category does not have a
                specific override below.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Deduction Type *</Label>
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
                        Fixed price ($ amount)
                      </SelectItem>
                      <SelectItem value="percentage">
                        Percentage (% of amount)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deduction_value">
                    {deductionType === "fixed"
                      ? "Default Amount ($) *"
                      : "Default Percentage (%) *"}
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
                  Category-Specific Deductions (Consultation, Lab, Pharmacy)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Optional. Leave the value empty to fall back to the default
                  deduction rule above.
                </p>
              </div>

              {/* Consultation */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Stethoscope className="h-4 w-4 text-sky-600" />
                  <span>Consultation Deduction</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
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
                        <SelectItem value="fixed">Fixed ($)</SelectItem>
                        <SelectItem value="percentage">
                          Percentage (%)
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
                        ? "Consultation Amount ($)"
                        : "Consultation Coverage (%)"}
                    </Label>
                    <Input
                      id="consultation_deduction_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Use default rule"
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
                  <span>Lab Deduction</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
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
                        <SelectItem value="fixed">Fixed ($)</SelectItem>
                        <SelectItem value="percentage">
                          Percentage (%)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lab_deduction_value" className="text-xs">
                      {labType === "fixed"
                        ? "Lab Amount ($)"
                        : "Lab Coverage (%)"}
                    </Label>
                    <Input
                      id="lab_deduction_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Use default rule"
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
                  <span>Pharmacy & Prescription Deduction</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
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
                        <SelectItem value="fixed">Fixed ($)</SelectItem>
                        <SelectItem value="percentage">
                          Percentage (%)
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
                        ? "Pharmacy Amount ($)"
                        : "Pharmacy Coverage (%)"}
                    </Label>
                    <Input
                      id="pharmacy_deduction_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Use default rule"
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
                <Label htmlFor="covered_visits">Covered Visits</Label>
                <Input
                  id="covered_visits"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  {...form.register("covered_visits", {
                    setValueAs: (v) =>
                      v === "" || v === null ? null : Number(v),
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited visits.
                </p>
                {form.formState.errors.covered_visits && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.covered_visits.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_active">Active</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Add Company"}
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
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The company is removed from the list and can no longer be used at
              billing. Existing invoices and claims are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={isPending}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
