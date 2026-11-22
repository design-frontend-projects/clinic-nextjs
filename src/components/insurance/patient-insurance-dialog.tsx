"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  assignPatientInsurance,
  getInsuranceProviders,
  getPatientInsurances,
  removePatientInsurance,
  updatePatientInsurance,
} from "@/app/actions/insurance";
import {
  assignPatientInsuranceSchema,
  type AssignPatientInsuranceData,
  type PatientInsuranceRow,
} from "@/types/insurance.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

interface PatientInsuranceDialogProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Deduction rule + remaining visits, rendered inline on a policy row. */
export function PolicySummary({ policy }: { policy: PatientInsuranceRow }) {
  const t = useTranslations("insurance.patientDialog");
  const rule =
    policy.deduction_type === "fixed"
      ? t("perVisit", { amount: policy.deduction_value.toFixed(2) })
      : t("percentOfInvoice", { percent: policy.deduction_value });
  const visits =
    policy.remaining_visits === null
      ? t("unlimitedVisits")
      : t("visitsRemaining", {
          remaining: policy.remaining_visits,
          total: policy.covered_visits ?? 0,
        });
  return (
    <span className="text-xs text-muted-foreground">
      {rule}
      {policy.consultation_deduction_value !== null
        ? ` · ${t("shortConsult", { value: (policy.consultation_deduction_type ?? policy.deduction_type) === "fixed" ? `$${policy.consultation_deduction_value.toFixed(2)}` : `${policy.consultation_deduction_value}%` })}`
        : ""}
      {policy.lab_deduction_value !== null
        ? ` · ${t("shortLab", { value: (policy.lab_deduction_type ?? policy.deduction_type) === "fixed" ? `$${policy.lab_deduction_value.toFixed(2)}` : `${policy.lab_deduction_value}%` })}`
        : ""}
      {policy.pharmacy_deduction_value !== null
        ? ` · ${t("shortPharm", { value: (policy.pharmacy_deduction_type ?? policy.deduction_type) === "fixed" ? `$${policy.pharmacy_deduction_value.toFixed(2)}` : `${policy.pharmacy_deduction_value}%` })}`
        : ""}{" "}
      · {visits}
    </span>
  );
}

export function PatientInsuranceDialog({
  patientId,
  patientName,
  open,
  onOpenChange,
}: PatientInsuranceDialogProps) {
  const t = useTranslations("insurance.patientDialog");
  const [editing, setEditing] = useState<PatientInsuranceRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { data: policies = [], refetch } = useQuery({
    queryKey: ["patient-insurances", patientId],
    queryFn: () => getPatientInsurances(patientId),
    enabled: open,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["insurance-providers"],
    queryFn: () => getInsuranceProviders(),
    enabled: open && formOpen,
  });

  const form = useForm<AssignPatientInsuranceData>({
    resolver: zodResolver(assignPatientInsuranceSchema),
    defaultValues: {
      patient_id: patientId,
      provider_id: "",
      policy_number: "",
      valid_from: "",
      valid_to: "",
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      patient_id: patientId,
      provider_id: "",
      policy_number: "",
      valid_from: "",
      valid_to: "",
    });
    setFormOpen(true);
  };

  const openEdit = (policy: PatientInsuranceRow) => {
    setEditing(policy);
    form.reset({
      patient_id: patientId,
      provider_id: policy.provider_id,
      policy_number: policy.policy_number ?? "",
      valid_from: policy.valid_from ? policy.valid_from.slice(0, 10) : "",
      valid_to: policy.valid_to ? policy.valid_to.slice(0, 10) : "",
    });
    setFormOpen(true);
  };

  const onSubmit = (data: AssignPatientInsuranceData) => {
    startTransition(async () => {
      const result = editing
        ? await updatePatientInsurance(editing.id, data)
        : await assignPatientInsurance(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? t("toastUpdated") : t("toastAssigned"));
      setFormOpen(false);
      refetch();
    });
  };

  const onRemove = (policy: PatientInsuranceRow) => {
    startTransition(async () => {
      const result = await removePatientInsurance(policy.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toastRemoved"));
      refetch();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { name: patientName })}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {!formOpen ? (
          <div className="space-y-3">
            {policies.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              policies.map((policy) => (
                <div
                  key={policy.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{policy.provider_name}</p>
                        <Badge
                          variant={policy.is_eligible ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {policy.is_eligible ? t("eligible") : t("notEligible")}
                        </Badge>
                      </div>
                      <PolicySummary policy={policy} />
                      <p className="text-xs text-muted-foreground">
                        {policy.policy_number
                          ? t("policyNumberPrefix", { number: policy.policy_number })
                          : t("noPolicyNumber")}
                        {policy.valid_to
                          ? ` · ${t("expiresOn", { date: format(new Date(policy.valid_to), "MMM d, yyyy") })}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(policy)}
                      aria-label={t("ariaEditPolicy")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(policy)}
                      disabled={isPending}
                      aria-label={t("ariaRemovePolicy")}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("close")}
              </Button>
              <Button onClick={openCreate}>
                <Plus className="me-2 h-4 w-4" />
                {t("assignInsurance")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("companyLabel")}</Label>
              <Select
                value={form.watch("provider_id")}
                onValueChange={(v) => form.setValue("provider_id", v)}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCompanyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {providers
                    .filter((p) => p.is_active || p.id === editing?.provider_id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.provider_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.provider_id.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy_number">{t("policyNumberLabel")}</Label>
              <Input
                id="policy_number"
                {...form.register("policy_number")}
                placeholder="e.g. POL-2026-0001"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from">{t("validFromLabel")}</Label>
                <Input id="valid_from" type="date" {...form.register("valid_from")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_to">{t("validToLabel")}</Label>
                <Input id="valid_to" type="date" {...form.register("valid_to")} />
                {form.formState.errors.valid_to && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.valid_to.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                {t("back")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("saving") : editing ? t("saveChanges") : t("assign")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
