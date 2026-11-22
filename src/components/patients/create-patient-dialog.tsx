"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPatient } from "@/app/actions/admin";
import { usePermission } from "@/features/rbac/hooks/useAuthorization";
import {
  buildPatientFormSchema,
  type CreatePatientInput,
  type PatientGender,
} from "@/types/patient.types";
import { Button } from "@/components/ui/button";
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

  if (!canCreate) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(DEFAULT_VALUES);
      setServerError(null);
    }
  };

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
        const message =
          error instanceof Error ? error.message : t("failed");
        setServerError(message);
        toast.error(message);
      }
    });
  };

  const selectedGender = form.watch("gender") ?? "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patient-first-name">{t("firstName")} *</Label>
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
              <Label htmlFor="patient-last-name">{t("lastName")} *</Label>
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
              <Label htmlFor="patient-email">{t("email")}</Label>
              <Input
                id="patient-email"
                type="email"
                {...form.register("email")}
                placeholder={t("emailPlaceholder")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-phone">{t("phone")}</Label>
              <Input
                id="patient-phone"
                {...form.register("phone")}
                placeholder={t("phonePlaceholder")}
              />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.phone.message}
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
                <SelectTrigger id="patient-gender">
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
              <Label htmlFor="patient-dob">{t("dob")}</Label>
              <Input
                id="patient-dob"
                type="date"
                {...form.register("date_of_birth")}
              />
              {form.formState.errors.date_of_birth && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.date_of_birth.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="patient-address">{t("address")}</Label>
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
