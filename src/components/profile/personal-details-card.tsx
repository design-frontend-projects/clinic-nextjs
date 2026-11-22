"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldAlert, User } from "lucide-react";
import { z } from "zod";

import {
  requestPhoneChangeOtp,
  updateMyProfileDetails,
} from "@/app/actions/profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneOtpDialog } from "@/components/profile/phone-otp-dialog";
import type { UserProfileView } from "@/types/profile.types";

const PHONE_REGEX = /^[+\d\s\-().]{6,30}$/;

interface PersonalDetailsCardProps {
  profile: UserProfileView;
}

interface PendingOtpState {
  newPhone: string;
  maskedEmail: string;
}

export function PersonalDetailsCard({ profile }: PersonalDetailsCardProps) {
  const t = useTranslations("pages.profile");
  const queryClient = useQueryClient();
  const [pendingOtp, setPendingOtp] = useState<PendingOtpState | null>(null);

  const formSchema = useMemo(
    () =>
      z.object({
        full_name: z
          .string()
          .trim()
          .min(2, t("errFullNameMin"))
          .max(120, t("errFullNameMax")),
        phone: z
          .string()
          .trim()
          .refine(
            (val) => val.length === 0 || PHONE_REGEX.test(val),
            t("errPhoneInvalid"),
          ),
      }),
    [t],
  );

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: profile.full_name,
      phone: profile.phone,
    },
  });

  useEffect(() => {
    form.reset({
      full_name: profile.full_name,
      phone: profile.phone,
    });
  }, [profile.full_name, profile.phone, form]);

  const updateNameMutation = useMutation({
    mutationFn: (full_name: string) => updateMyProfileDetails({ full_name }),
  });

  const requestOtpMutation = useMutation({
    mutationFn: (newPhone: string) => requestPhoneChangeOtp({ newPhone }),
  });

  const isSubmitting =
    updateNameMutation.isPending || requestOtpMutation.isPending;

  const onSubmit = async (values: FormValues) => {
    const trimmedName = values.full_name.trim();
    const trimmedPhone = values.phone.trim();
    const currentName = profile.full_name.trim();
    const currentPhone = profile.phone.trim();

    const nameChanged = trimmedName !== currentName;
    const phoneChanged = trimmedPhone !== currentPhone;

    if (!nameChanged && !phoneChanged) {
      return;
    }

    if (phoneChanged && !PHONE_REGEX.test(trimmedPhone)) {
      form.setError("phone", { message: t("errPhoneInvalid") });
      return;
    }

    if (nameChanged) {
      const nameResult = await updateNameMutation.mutateAsync(trimmedName);
      if (!nameResult.success) {
        toast.error(nameResult.error || t("toastProfileFailed"));
        return;
      }
      toast.success(t("toastNameUpdated"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-info"] }),
        queryClient.invalidateQueries({ queryKey: ["my-patient-record"] }),
      ]);
      if (!phoneChanged) {
        form.reset({ full_name: trimmedName, phone: currentPhone });
      }
    }

    if (phoneChanged) {
      const otpResult = await requestOtpMutation.mutateAsync(trimmedPhone);
      if (!otpResult.success) {
        toast.error(
          otpResult.code === "rate_limited"
            ? t("toastOtpRateLimited")
            : otpResult.error || t("toastOtpSendFailed"),
        );
        return;
      }
      toast.success(t("toastOtpSent"));
      setPendingOtp({
        newPhone: trimmedPhone,
        maskedEmail: otpResult.maskedEmail,
      });
    }
  };

  const handleOtpVerified = async (verifiedPhone: string) => {
    setPendingOtp(null);
    form.reset({
      full_name: form.getValues("full_name").trim() || profile.full_name,
      phone: verifiedPhone,
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["tenant-info"] }),
      queryClient.invalidateQueries({ queryKey: ["my-patient-record"] }),
    ]);
  };

  const handleOtpCancel = () => {
    setPendingOtp(null);
    form.setValue("phone", profile.phone, { shouldDirty: false });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("personalDetailsTitle")}</CardTitle>
          <CardDescription>{t("personalDetailsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="profile-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {t("lblEmailReadOnly")}
              </Label>
              <Input
                id="profile-email"
                value={profile.email}
                disabled
                readOnly
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {t("emailReadOnlyHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="profile-full-name"
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                {t("lblFullName")}
              </Label>
              <Input
                id="profile-full-name"
                placeholder={t("placeholderFullName")}
                disabled={isSubmitting}
                {...form.register("full_name")}
              />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label
                  htmlFor="profile-phone"
                  className="flex items-center gap-2"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {t("lblPhone")}
                </Label>
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <ShieldAlert className="h-3 w-3 text-primary" />
                  {t("phoneOtpBadge")}
                </Badge>
              </div>
              <Input
                id="profile-phone"
                dir="ltr"
                placeholder={t("placeholderPhone")}
                disabled={isSubmitting}
                {...form.register("phone")}
              />
              <p className="text-xs text-muted-foreground">
                {t("phoneOtpHint")}
              </p>
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isDirty}
            >
              {isSubmitting && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {isSubmitting ? t("btnSaving") : t("btnSave")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PhoneOtpDialog
        open={Boolean(pendingOtp)}
        newPhone={pendingOtp?.newPhone ?? ""}
        maskedEmail={pendingOtp?.maskedEmail ?? ""}
        onVerified={(verifiedPhone) => void handleOtpVerified(verifiedPhone)}
        onCancel={handleOtpCancel}
      />
    </>
  );
}
