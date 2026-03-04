"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Mail, Phone, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileSchema, type ProfileFormData } from "@/types/onboarding.types";

type ProfileSetupStepProps = {
  defaultValues?: Partial<ProfileFormData>;
  onSubmit: (data: ProfileFormData) => void;
  loading?: boolean;
};

export function ProfileSetupStep({
  defaultValues,
  onSubmit,
  loading,
}: ProfileSetupStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: defaultValues?.full_name ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      role: "admin",
      specialty: defaultValues?.specialty ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="full_name" className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Full Name
        </Label>
        <Input
          id="full_name"
          placeholder="Dr. John Doe"
          {...register("full_name")}
        />
        {errors.full_name && (
          <p className="text-xs text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="profile_email" className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email
        </Label>
        <Input
          id="profile_email"
          type="email"
          placeholder="john@clinic.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Phone (optional)
        </Label>
        <Input
          id="phone"
          placeholder="+1 (555) 123-4567"
          {...register("phone")}
        />
      </div>

      {/* Specialty */}
      <div className="space-y-2">
        <Label htmlFor="specialty" className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          Specialty (optional)
        </Label>
        <Input
          id="specialty"
          placeholder="e.g. Dermatology, Pediatrics"
          {...register("specialty")}
        />
      </div>

      {/* Hidden role */}
      <input type="hidden" {...register("role")} />

      <Button type="submit" className="w-full" disabled={loading}>
        Continue to Clinic Setup →
      </Button>
    </form>
  );
}
