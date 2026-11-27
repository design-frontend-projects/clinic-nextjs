"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Building,
  Mail,
  Phone,
  FileText,
  CreditCard,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BranchMultiSelect } from "@/components/shared/branch-multi-select";
import {
  clinicSchema,
  type ClinicFormData,
  type OnboardingBranchItem,
} from "@/types/onboarding.types";
import { getActiveSpecialties } from "@/app/actions/specialties";
import type { ActiveSpecialty } from "@/types/specialty.types";
import { useLocale, useTranslations } from "next-intl";

type ClinicSetupStepProps = {
  availableBranches: OnboardingBranchItem[];
  defaultValues?: Partial<ClinicFormData>;
  onSubmit: (data: ClinicFormData) => void;
  onBack: () => void;
  loading?: boolean;
};

export function ClinicSetupStep({
  availableBranches,
  defaultValues,
  onSubmit,
  onBack,
  loading,
}: ClinicSetupStepProps) {
  const locale = useLocale();
  const t = useTranslations("clinic");
  const tBranch = useTranslations("branch");
  const tOnboarding = useTranslations("auth.onboarding");
  const [specialties, setSpecialties] = useState<ActiveSpecialty[]>([]);

  useEffect(() => {
    let active = true;
    getActiveSpecialties()
      .then((rows) => {
        if (active) setSpecialties(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const availableIds = new Set(availableBranches.map((b) => b.id));
  const initialSelected =
    defaultValues?.branch_ids?.filter((id) => availableIds.has(id)) ?? [];
  const defaultBranchIds =
    initialSelected.length > 0
      ? initialSelected
      : availableBranches.map((b) => b.id);
  const defaultPrimaryId =
    defaultValues?.primary_branch_id &&
    defaultBranchIds.includes(defaultValues.primary_branch_id)
      ? defaultValues.primary_branch_id
      : defaultBranchIds[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClinicFormData>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      registration_number: defaultValues?.registration_number ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      subscription_plan: defaultValues?.subscription_plan ?? "free",
      specialty_id: defaultValues?.specialty_id,
      is_primary: defaultValues?.is_primary ?? true,
      branch_ids: defaultBranchIds,
      primary_branch_id: defaultPrimaryId,
    },
  });

  const selectedPlan = watch("subscription_plan");
  const selectedBranchIds = watch("branch_ids") ?? [];
  const selectedPrimaryBranchId = watch("primary_branch_id");

  // Reconcile selections if the owner went back and edited their branches.
  useEffect(() => {
    const validIds = new Set(availableBranches.map((b) => b.id));
    const filtered = selectedBranchIds.filter((id) => validIds.has(id));
    if (filtered.length !== selectedBranchIds.length) {
      const nextIds =
        filtered.length > 0 ? filtered : availableBranches.map((b) => b.id);
      setValue("branch_ids", nextIds, { shouldValidate: true });
      setValue(
        "primary_branch_id",
        selectedPrimaryBranchId && nextIds.includes(selectedPrimaryBranchId)
          ? selectedPrimaryBranchId
          : nextIds[0],
      );
    } else if (filtered.length === 0 && availableBranches.length > 0) {
      const nextIds = availableBranches.map((b) => b.id);
      setValue("branch_ids", nextIds);
      setValue("primary_branch_id", nextIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableBranches]);

  const subscriptionPlans = [
    { value: "free", label: t("free") },
    { value: "starter", label: t("starter") },
    { value: "professional", label: t("professional") },
    { value: "enterprise", label: t("enterprise") },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="clinic_name" className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {t("name")} *
        </Label>
        <Input
          id="clinic_name"
          placeholder={t("namePlaceholder")}
          {...register("name")}
          autoFocus
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          {t("branches")} *
        </Label>
        <BranchMultiSelect
          options={availableBranches}
          selectedIds={selectedBranchIds}
          primaryId={selectedPrimaryBranchId}
          onChange={(ids, primaryId) => {
            setValue("branch_ids", ids, { shouldValidate: true });
            setValue("primary_branch_id", primaryId);
          }}
          placeholder={t("selectBranchesPlaceholder")}
          searchPlaceholder={t("searchBranchesPlaceholder")}
          emptyText={t("noBranchesAvailable")}
          primaryLabel={tBranch("primaryBadge")}
          setPrimaryLabel={tBranch("setPrimary")}
          selectedCountLabel={(count) => t("branchesSelectedCount", { count })}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">{t("branchesHint")}</p>
        {errors.branch_ids && (
          <p className="text-xs text-destructive">
            {errors.branch_ids.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          {t("specialty")}
        </Label>
        <Select
          value={watch("specialty_id") ?? "__none__"}
          onValueChange={(val) =>
            setValue("specialty_id", val === "__none__" ? undefined : val)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectSpecialty")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("noSpecialty")}</SelectItem>
            {specialties.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {locale === "ar" && s.name_ar ? s.name_ar : s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="registration_number"
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          {t("registrationNumber")}
        </Label>
        <Input
          id="registration_number"
          placeholder={t("regNumberPlaceholder")}
          {...register("registration_number")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clinic_email" className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {t("email")}
          </Label>
          <Input
            id="clinic_email"
            type="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clinic_phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {t("phone")}
          </Label>
          <Input
            id="clinic_phone"
            placeholder={t("phonePlaceholder")}
            {...register("phone")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {t("subscriptionPlan")}
        </Label>
        <Select
          value={selectedPlan || "free"}
          onValueChange={(val) => setValue("subscription_plan", val)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectPlan")} />
          </SelectTrigger>
          <SelectContent>
            {subscriptionPlans.map((plan) => (
              <SelectItem key={plan.value} value={plan.value}>
                {plan.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1"
        >
          <ArrowLeft className="me-2 h-4 w-4" />
          {tOnboarding("back")}
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="me-2 h-4 w-4" />
          )}
          {tOnboarding("initializeClinic")}
        </Button>
      </div>
    </form>
  );
}
