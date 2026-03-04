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

type ClinicSetupStepProps = {
  defaultValues?: Partial<ClinicFormData>;
  onSubmit: (data: ClinicFormData) => void;
  onBack: () => void;
  loading?: boolean;
};

const subscriptionPlans = [
  { value: "free", label: "Free — Basic Features" },
  { value: "starter", label: "Starter — Small Clinic" },
  { value: "professional", label: "Professional — Growing Practice" },
  { value: "enterprise", label: "Enterprise — Multi-Branch" },
];

export function ClinicSetupStep({
  defaultValues,
  onSubmit,
  onBack,
  loading,
}: ClinicSetupStepProps) {
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
    },
  });

  const selectedPlan = watch("subscription_plan");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Clinic Name */}
      <div className="space-y-2">
        <Label htmlFor="clinic_name" className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Clinic Name *
        </Label>
        <Input
          id="clinic_name"
          placeholder="e.g. Acme Health Center"
          {...register("name")}
          autoFocus
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Registration Number */}
      <div className="space-y-2">
        <Label
          htmlFor="registration_number"
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          Registration Number (optional)
        </Label>
        <Input
          id="registration_number"
          placeholder="e.g. MED-2024-001"
          {...register("registration_number")}
        />
      </div>

      {/* Email & Phone Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clinic_email" className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email
          </Label>
          <Input
            id="clinic_email"
            type="email"
            placeholder="info@clinic.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clinic_phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Phone
          </Label>
          <Input
            id="clinic_phone"
            placeholder="+1 (555) 000-0000"
            {...register("phone")}
          />
        </div>
      </div>

      {/* Subscription Plan */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Subscription Plan
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

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Initialize Clinic
        </Button>
      </div>
    </form>
  );
}
