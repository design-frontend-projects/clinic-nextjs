"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Mail,
  Phone,
  FileText,
  CreditCard,
  Loader2,
  CheckCircle,
  ArrowLeft,
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
import { clinicSchema, type ClinicFormData } from "@/types/onboarding.types";
import { useTranslations } from "next-intl";

type ClinicSetupStepProps = {
  defaultValues?: Partial<ClinicFormData>;
  onSubmit: (data: ClinicFormData) => void;
  onBack: () => void;
  loading?: boolean;
};

export function ClinicSetupStep({
  defaultValues,
  onSubmit,
  onBack,
  loading,
}: ClinicSetupStepProps) {
  const t = useTranslations("clinic");
  const tOnboarding = useTranslations("auth.onboarding");
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
      is_primary: defaultValues?.is_primary ?? true,
    },
  });

  const selectedPlan = watch("subscription_plan");

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

      <div className="grid grid-cols-2 gap-4">
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
            <SelectValue placeholder="Select a plan" />
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
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tOnboarding("back")}
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          {tOnboarding("initializeClinic")}
        </Button>
      </div>
    </form>
  );
}
