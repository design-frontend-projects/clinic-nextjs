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
      {/* Branch Name */}
      <div className="space-y-2">
        <Label htmlFor="branch_name" className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          Branch Name *
        </Label>
        <Input
          id="branch_name"
          placeholder="e.g. Main Branch"
          {...register("name")}
          autoFocus
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address" className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Address (optional)
        </Label>
        <Input
          id="address"
          placeholder="e.g. 123 Health Ave, NY"
          {...register("address")}
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="branch_phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Branch Phone (optional)
        </Label>
        <Input
          id="branch_phone"
          placeholder="+1 (555) 000-0000"
          {...register("phone")}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex gap-3">
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
            Complete Setup
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSubmit({ name: "Main Branch" })}
          disabled={loading}
          className="w-full text-muted-foreground"
        >
          Skip for now
        </Button>
      </div>
    </form>
  );
}
