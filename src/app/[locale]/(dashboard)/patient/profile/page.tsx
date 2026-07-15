"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { getMyPatientRecord, updateMyProfile } from "@/app/actions/patient";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

export default function PatientProfilePage() {
  const t = useTranslations("pages.patient.profile");
  const queryClient = useQueryClient();
  const supabase = createSupabaseClient();

  const profileSchema = useMemo(() => z.object({
    phone: z
      .string()
      .trim()
      .min(6, t("errPhoneMin"))
      .max(30, t("errPhoneMax")),
  }), [t]);

  const passwordSchema = useMemo(() => z
    .object({
      password: z.string().min(6, t("errPasswordMin")),
      confirmPassword: z.string().min(6, t("errConfirmPassword")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("errPasswordMismatch"),
      path: ["confirmPassword"],
    }), [t]);

  type PatientProfileUpdateData = z.infer<typeof profileSchema>;
  type PasswordChangeData = z.infer<typeof passwordSchema>;

  const { data: record } = useQuery({
    queryKey: ["my-patient-record"],
    queryFn: () => getMyPatientRecord(),
  });

  const profileForm = useForm<PatientProfileUpdateData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { phone: "" },
  });

  useEffect(() => {
    if (record?.profile?.phone) {
      profileForm.reset({ phone: record.profile.phone });
    }
  }, [record?.profile?.phone, profileForm]);

  const profileMutation = useMutation({
    mutationFn: (data: PatientProfileUpdateData) => updateMyProfile(data),
    onSuccess: (result) => {
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toastProfileUpdated"));
      queryClient.invalidateQueries({ queryKey: ["my-patient-record"] });
    },
    onError: () => toast.error(t("toastProfileFailed")),
  });

  const passwordForm = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onChangePassword = async (data: PasswordChangeData) => {
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      toast.error(error.message || t("toastPasswordFailed"));
      return;
    }
    toast.success(t("toastPasswordUpdated"));
    passwordForm.reset();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("contactDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>{t("lblFullName")}</Label>
                <Input value={record?.profile?.full_name ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>{t("lblEmail")}</Label>
                <Input value={record?.profile?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("lblPhone")}</Label>
                <Input id="phone" {...profileForm.register("phone")} placeholder="+1 234 567 890" />
                {profileForm.formState.errors.phone && (
                  <p className="text-xs text-destructive">
                    {profileForm.formState.errors.phone.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("btnSave")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("changePassword")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit(onChangePassword)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="password">{t("lblNewPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("lblConfirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...passwordForm.register("confirmPassword")}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("btnUpdatePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
