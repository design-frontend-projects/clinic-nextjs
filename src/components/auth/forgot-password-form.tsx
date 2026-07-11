"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

const forgotPasswordSchema = (invalidEmail: string) =>
  z.object({
    email: z.string().email(invalidEmail),
  });

type ForgotPasswordValues = z.infer<ReturnType<typeof forgotPasswordSchema>>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const t = useTranslations("auth.forgotPassword");
  const locale = useLocale();
  const supabase = createSupabaseClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema(t("invalidEmail"))),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setIsLoading(true);
    try {
      // The recovery link must go through /auth/callback so the code/token is
      // exchanged for a session before landing on the localized reset page.
      const next = encodeURIComponent(`/${locale}/reset-password`);
      const redirectTo = `${window.location.origin}/auth/callback?next=${next}`;
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      setIsSent(true);
      toast.success(t("sentToast"));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("error")));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="text-center py-4 space-y-4">
        <MailCheck className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("sentMessage")}</p>
        <p className="text-xs text-muted-foreground">{t("sentSpamHint")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
      <div className="space-y-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full text-sm mt-2" disabled={isLoading}>
        {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        {t("sendButton")}
      </Button>
    </form>
  );
}
