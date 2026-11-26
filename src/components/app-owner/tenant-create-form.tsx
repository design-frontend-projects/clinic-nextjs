"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Building2,
  CreditCard,
  Loader2,
  MapPin,
  Stethoscope,
  User,
} from "lucide-react";

import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const locale = useLocale();
  const t = useTranslations("appOwner.tenantCreate");
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
        toast.success(t("toastCreatedEmailSent"));
      } else {
        toast.warning(t("toastCreatedEmailFailed"));
      }
      setCreated({
        tempPassword: result.tempPassword,
        fullName: result.profile.full_name ?? result.ownerName,
        email: result.profile.email ?? result.ownerEmail,
        phone: result.profile.phone ?? data.owner.phone,
      });
    });
  };

  const fieldError = (message?: string) =>
    message ? <p className="text-xs text-destructive">{message}</p> : null;

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card elevated cornerAccent>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>{t("ownerAccountTitle")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner_full_name">
                  {t("ownerFullNameLabel")}
                </Label>
                <Input
                  id="owner_full_name"
                  {...form.register("owner.full_name")}
                  placeholder={t("ownerFullNamePlaceholder")}
                />
                {fieldError(form.formState.errors.owner?.full_name?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_email">{t("ownerEmailLabel")}</Label>
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
              <Label htmlFor="owner_phone">{t("ownerPhoneLabel")}</Label>
              <Input
                id="owner_phone"
                dir="ltr"
                {...form.register("owner.phone")}
              />
            </div>
          </CardContent>
        </Card>

        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{t("clinicDetailsTitle")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clinic_name">{t("clinicNameLabel")}</Label>
                <Input
                  id="clinic_name"
                  {...form.register("clinic.name")}
                  placeholder={t("clinicNamePlaceholder")}
                />
                {fieldError(form.formState.errors.clinic?.name?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_registration_number">
                  {t("registrationNumberLabel")}
                </Label>
                <Input
                  id="clinic_registration_number"
                  {...form.register("clinic.registration_number")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_email">{t("clinicEmailLabel")}</Label>
                <Input
                  id="clinic_email"
                  type="email"
                  {...form.register("clinic.email")}
                />
                {fieldError(form.formState.errors.clinic?.email?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_phone">{t("clinicPhoneLabel")}</Label>
                <Input
                  id="clinic_phone"
                  dir="ltr"
                  {...form.register("clinic.phone")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span>{t("subscriptionPlanTitle")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>{t("planLabel")}</Label>
            <Select
              onValueChange={(v) =>
                form.setValue("plan_id", v, { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full md:max-w-[calc(50%-0.5rem)]">
                <SelectValue placeholder={t("planPlaceholder")} />
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
                {t("noActivePlans")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{t("mainBranchTitle")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch_name">{t("branchNameLabel")}</Label>
                <Input id="branch_name" {...form.register("branch.name")} />
                {fieldError(form.formState.errors.branch?.name?.message)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch_phone">{t("branchPhoneLabel")}</Label>
                <Input
                  id="branch_phone"
                  dir="ltr"
                  {...form.register("branch.phone")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_address">{t("branchAddressLabel")}</Label>
              <Input id="branch_address" {...form.register("branch.address")} />
            </div>
          </CardContent>
        </Card>

        <Card elevated>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <span>{t("specialtiesTitle")}</span>
            </CardTitle>
            {selectedSpecialtyIds.length > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {selectedSpecialtyIds.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {specialties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noActiveSpecialties")}
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {specialties.map((specialty) => {
                  const isChecked = selectedSpecialtyIds.includes(specialty.id);
                  return (
                    <label
                      key={specialty.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-button)] border px-3 py-2.5 text-sm transition-colors",
                        isChecked
                          ? "border-primary bg-accent-blue-soft text-foreground dark:bg-accent-green-soft"
                          : "border-hairline bg-canvas-soft/50 text-foreground hover:bg-accent dark:bg-surface-elevated/40",
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(c) =>
                          toggleSpecialty(specialty.id, Boolean(c))
                        }
                      />
                      <span className="truncate font-medium">
                        {locale === "ar" && specialty.name_ar
                          ? specialty.name_ar
                          : specialty.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/app-owner/tenants")}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("createTenant")}
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
