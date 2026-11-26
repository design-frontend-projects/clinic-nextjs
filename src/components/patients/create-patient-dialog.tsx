"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInYears, format, parse } from "date-fns";
import { useTranslations } from "next-intl";
import { MapPin, Phone, Plus, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createPatient } from "@/app/actions/admin";
import { usePermission } from "@/features/rbac/hooks/useAuthorization";
import {
  buildPatientFormSchema,
  type CreatePatientInput,
  type PatientGender,
} from "@/types/patient.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CreatePatientDialogProps {
  onCreated?: () => void;
}

const DEFAULT_VALUES: CreatePatientInput = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: undefined,
  date_of_birth: "",
  address: "",
};

/**
 * Shared patient creation modal used by both admin and staff patient pages.
 * Enforces `patient.create` visibility client-side and handles structured
 * `{ success, patient } | { error }` server action results cleanly.
 */
export function CreatePatientDialog({ onCreated }: CreatePatientDialogProps) {
  const canCreate = usePermission("patient.create");
  const t = useTranslations("patients.createModal");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(
    () =>
      buildPatientFormSchema({
        firstNameRequired: t("errFirstNameRequired"),
        lastNameRequired: t("errLastNameRequired"),
        emailInvalid: t("errEmailInvalid"),
      }),
    [t],
  );

  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  const selectedGender = form.watch("gender") ?? "";
  const dobString = form.watch("date_of_birth") ?? "";
  const dobDate = useMemo(() => {
    if (!dobString) return undefined;
    const parsed = parse(dobString, "yyyy-MM-dd", new Date());
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [dobString]);
  const calculatedAge = useMemo(() => {
    if (!dobDate) return null;
    const yrs = differenceInYears(new Date(), dobDate);
    return yrs >= 0 ? yrs : null;
  }, [dobDate]);

  // Keep an already-open modal mounted if permissions briefly refetch/flicker.
  if (!canCreate && !open) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isPending) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(DEFAULT_VALUES);
      setServerError(null);
    }
  };

  const blockDismiss = isPending || form.formState.isDirty;

  const onSubmit = (data: CreatePatientInput) => {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await createPatient(data);
        if ("error" in result) {
          const message = result.error || t("failed");
          setServerError(message);
          toast.error(message);
          return;
        }
        toast.success(t("success"));
        handleOpenChange(false);
        onCreated?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : t("failed");
        setServerError(message);
        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="me-2 h-4 w-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => {
          if (blockDismiss) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (blockDismiss) e.preventDefault();
        }}
        className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="border-b border-hairline px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-start">
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {t("description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </div>
            )}

            {/* Personal Information Section */}
            <div className="space-y-4 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>{t("personalInfoTitle")}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="patient-first-name">
                    {t("firstName")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="patient-first-name"
                    {...form.register("first_name")}
                    placeholder={t("firstNamePlaceholder")}
                  />
                  {form.formState.errors.first_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.first_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patient-last-name">
                    {t("lastName")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="patient-last-name"
                    {...form.register("last_name")}
                    placeholder={t("lastNamePlaceholder")}
                  />
                  {form.formState.errors.last_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="patient-gender">{t("gender")}</Label>
                  <Select
                    value={selectedGender}
                    onValueChange={(value) =>
                      form.setValue(
                        "gender",
                        value ? (value as PatientGender) : undefined,
                        { shouldValidate: true },
                      )
                    }
                  >
                    <SelectTrigger id="patient-gender" className="w-full">
                      <SelectValue placeholder={t("genderPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("male")}</SelectItem>
                      <SelectItem value="female">{t("female")}</SelectItem>
                      <SelectItem value="other">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.gender && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.gender.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="patient-dob">{t("dob")}</Label>
                    {calculatedAge !== null && (
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
                      >
                        {t("ageYears", { age: calculatedAge })}
                      </Badge>
                    )}
                  </div>
                  <DatePicker
                    id="patient-dob"
                    value={dobDate}
                    onChange={(selected) =>
                      form.setValue(
                        "date_of_birth",
                        selected ? format(selected, "yyyy-MM-dd") : "",
                        { shouldValidate: true },
                      )
                    }
                    placeholder={t("dobPlaceholder")}
                    captionLayout="dropdown"
                    fromYear={1900}
                    toYear={new Date().getFullYear()}
                    disabledDates={(d) =>
                      d > new Date() || d < new Date("1900-01-01")
                    }
                    clearable
                    clearLabel={tCommon("clear")}
                  />
                  {form.formState.errors.date_of_birth && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.date_of_birth.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact & Address Section */}
            <div className="space-y-4 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>{t("contactInfoTitle")}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="patient-phone">{t("phone")}</Label>
                  <Input
                    id="patient-phone"
                    dir="ltr"
                    {...form.register("phone")}
                    placeholder={t("phonePlaceholder")}
                  />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patient-email">{t("email")}</Label>
                  <Input
                    id="patient-email"
                    type="email"
                    dir="ltr"
                    {...form.register("email")}
                    placeholder={t("emailPlaceholder")}
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="patient-address"
                  className="flex items-center gap-1.5"
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t("address")}</span>
                </Label>
                <Input
                  id="patient-address"
                  {...form.register("address")}
                  placeholder={t("addressPlaceholder")}
                />
                {form.formState.errors.address && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.address.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-hairline bg-surface px-5 py-3.5 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isPending}
            >
              {isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
