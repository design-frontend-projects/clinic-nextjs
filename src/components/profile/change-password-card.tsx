"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { z } from "zod";

import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function ChangePasswordCard() {
  const t = useTranslations("pages.profile");

  const passwordSchema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(6, t("errPasswordMin")),
          confirmPassword: z.string().min(6, t("errConfirmPassword")),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("errPasswordMismatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

  type PasswordValues = z.infer<typeof passwordSchema>;

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: PasswordValues) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });
    if (error) {
      toast.error(error.message || t("toastPasswordFailed"));
      return;
    }
    toast.success(t("toastPasswordUpdated"));
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          {t("changePasswordTitle")}
        </CardTitle>
        <CardDescription>{t("changePasswordDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-new-password">{t("lblNewPassword")}</Label>
            <PasswordInput
              id="profile-new-password"
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={form.formState.isSubmitting}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-confirm-password">
              {t("lblConfirmPassword")}
            </Label>
            <PasswordInput
              id="profile-confirm-password"
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={form.formState.isSubmitting}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            )}
            {form.formState.isSubmitting
              ? t("btnUpdatingPassword")
              : t("btnUpdatePassword")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
