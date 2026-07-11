"use client";

import { useEffect, useState } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

const resetPasswordSchema = (
  passwordMin: string,
  confirmPasswordMin: string,
  passwordsMismatch: string,
) =>
  z
    .object({
      password: z.string().min(6, passwordMin),
      confirmPassword: z.string().min(6, confirmPasswordMin),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: passwordsMismatch,
      path: ["confirmPassword"],
    });

type ResetPasswordValues = z.infer<ReturnType<typeof resetPasswordSchema>>;

type LinkStatus = "checking" | "ready" | "invalid";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const t = useTranslations("auth.resetPassword");
  const supabase = createSupabaseClient();

  // The recovery link goes through /auth/callback, which establishes a session
  // before redirecting here (or appends ?error= when the link is invalid).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setLinkStatus("invalid");
      return;
    }

    let cancelled = false;
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setLinkStatus(data.user ? "ready" : "invalid");
        }
      } catch {
        if (!cancelled) {
          setLinkStatus("invalid");
        }
      }
    };
    checkSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(
      resetPasswordSchema(
        t("passwordMin"),
        t("confirmPasswordMin"),
        t("passwordsMismatch"),
      ),
    ),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        throw error;
      }

      // End the recovery session so the user signs in cleanly with the new password.
      await supabase.auth.signOut();

      toast.success(t("success"));
      router.push("/sign-in");
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("error")));
    } finally {
      setIsLoading(false);
    }
  };

  if (linkStatus === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("checking")}</p>
      </div>
    );
  }

  if (linkStatus === "invalid") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <TriangleAlert className="h-10 w-10 text-destructive" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {t("invalidLinkTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("invalidLinkMessage")}
          </p>
        </div>
        <Button asChild className="w-full text-sm mt-2">
          <Link href="/forgot-password">{t("requestNewLink")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
      <div className="space-y-2">
        <Label htmlFor="password">{t("passwordLabel")}</Label>
        <PasswordInput
          id="password"
          placeholder={t("passwordPlaceholder")}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
        <PasswordInput
          id="confirmPassword"
          placeholder={t("passwordPlaceholder")}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full text-sm mt-2" disabled={isLoading}>
        {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        {t("submitButton")}
      </Button>
    </form>
  );
}
