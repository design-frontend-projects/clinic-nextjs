"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createTenant } from "@/app/actions/app-owner/tenants";
import {
  createTenantSchema,
  type CreateTenantFormData,
  type PlanOption,
} from "@/types/tenant-creation.types";
import type { ActiveSpecialty } from "@/types/specialty.types";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantCreateFormProps {
  plans: PlanOption[];
  specialties: ActiveSpecialty[];
}

export function TenantCreateForm({ plans, specialties }: TenantCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [created, setCreated] = useState<TempPasswordInfo | null>(null);

  const form = useForm<CreateTenantFormData>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      owner: { full_name: "", email: "", phone: "" },
      clinic: { name: "", registration_number: "", email: "", phone: "" },
      plan_id: "",
      branch: { name: "Main Branch", address: "", phone: "" },
      specialtyIds: [],
    },
  });

  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<string[]>([]);

  const toggleSpecialty = (id: string, checked: boolean) => {
    const next = checked
      ? [...selectedSpecialtyIds, id]
      : selectedSpecialtyIds.filter((s) => s !== id);
    setSelectedSpecialtyIds(next);
    form.setValue("specialtyIds", next);
  };

  const onSubmit = (data: CreateTenantFormData) => {
    startTransition(async () => {
      const result = await createTenant(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.emailSent) {
        toast.success("Tenant created. A set-password email was sent to the owner.");
      } else {
        toast.warning(
          "Tenant created, but the set-password email could not be sent. Share the temporary password manually.",
        );
      }
      setCreated({
        tempPassword: result.tempPassword,
        fullName: result.ownerName,
        email: result.ownerEmail,
      });
    });
  };

  const fieldError = (message?: string) =>
    message ? <p className="text-xs text-destructive">{message}</p> : null;

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Owner Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner_full_name">Full Name *</Label>
                <Input
                  id="owner_full_name"
                  {...form.register("owner.full_name")}
                  placeholder="Dr. Jane Doe"
                />
                {fieldError(form.formState.errors.owner?.full_name?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_email">Email *</Label>
                <Input
                  id="owner_email"
                  type="email"
                  {...form.register("owner.email")}
                  placeholder="owner@clinic.com"
                />
                {fieldError(form.formState.errors.owner?.email?.message)}
              </div>
            </div>
            <div className="space-y-2 md:max-w-[calc(50%-0.5rem)]">
              <Label htmlFor="owner_phone">Phone</Label>
              <Input id="owner_phone" {...form.register("owner.phone")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinic Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clinic_name">Clinic Name *</Label>
                <Input
                  id="clinic_name"
                  {...form.register("clinic.name")}
                  placeholder="Sunrise Medical Center"
                />
                {fieldError(form.formState.errors.clinic?.name?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_registration_number">
                  Registration Number
                </Label>
                <Input
                  id="clinic_registration_number"
                  {...form.register("clinic.registration_number")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_email">Clinic Email</Label>
                <Input
                  id="clinic_email"
                  type="email"
                  {...form.register("clinic.email")}
                />
                {fieldError(form.formState.errors.clinic?.email?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_phone">Clinic Phone</Label>
                <Input id="clinic_phone" {...form.register("clinic.phone")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Plan *</Label>
            <Select onValueChange={(v) => form.setValue("plan_id", v)}>
              <SelectTrigger className="md:max-w-[calc(50%-0.5rem)]">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} — {plan.price} {plan.currency} /{" "}
                    {plan.billing_period.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError(form.formState.errors.plan_id?.message)}
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active plans available. Create a plan first.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Main Branch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch_name">Branch Name</Label>
                <Input id="branch_name" {...form.register("branch.name")} />
                {fieldError(form.formState.errors.branch?.name?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch_phone">Branch Phone</Label>
                <Input id="branch_phone" {...form.register("branch.phone")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_address">Address</Label>
              <Input id="branch_address" {...form.register("branch.address")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Specialties (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            {specialties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active specialties in the catalog.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {specialties.map((specialty) => (
                  <label
                    key={specialty.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedSpecialtyIds.includes(specialty.id)}
                      onCheckedChange={(c) =>
                        toggleSpecialty(specialty.id, Boolean(c))
                      }
                    />
                    {specialty.name}
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/app-owner/tenants")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Tenant
          </Button>
        </div>
      </form>

      <TempPasswordDialog
        info={created}
        onClose={() => {
          setCreated(null);
          router.push("/app-owner/tenants");
          router.refresh();
        }}
      />
    </>
  );
}
