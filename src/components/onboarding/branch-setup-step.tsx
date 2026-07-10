"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  MapPin,
  Phone,
  Building,
  Loader2,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { branchSchema, type BranchFormData } from "@/types/onboarding.types";
import { useTranslations } from "next-intl";

type BranchSetupStepProps = {
  defaultValues?: Partial<BranchFormData>;
  onSubmit: (data: BranchFormData) => void;
  onBack: () => void;
  loading?: boolean;
};

export function BranchSetupStep({
  defaultValues,
  onSubmit,
  onBack,
  loading,
}: BranchSetupStepProps) {
  const t = useTranslations("branch");
  const tOnboarding = useTranslations("auth.onboarding");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: defaultValues?.name ?? "Main Branch",
      address: defaultValues?.address ?? "",
      phone: defaultValues?.phone ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="branch_name" className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          {t("name")} *
        </Label>
        <Input
          id="branch_name"
          placeholder={t("namePlaceholder")}
          {...register("name")}
          autoFocus
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address" className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {t("address")}
        </Label>
        <Input
          id="address"
          placeholder={t("addressPlaceholder")}
          {...register("address")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="branch_phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          {t("phone")}
        </Label>
        <Input
          id="branch_phone"
          placeholder={t("phonePlaceholder")}
          {...register("phone")}
        />
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex gap-3">
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
              <CheckCircle className="me-2 h-4 w-4" />
            )}
            {tOnboarding("completeSetup")}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSubmit({ name: "Main Branch" })}
          disabled={loading}
          className="w-full text-muted-foreground"
        >
          {tOnboarding("skipForNow")}
        </Button>
      </div>
    </form>
  );
}
