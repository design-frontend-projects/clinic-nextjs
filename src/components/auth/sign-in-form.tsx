"use client";
import { motion } from "framer-motion";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createSupabaseClient } from "@/lib/supabase/client";
import { mapSignInErrorKey, type SignInErrorKey } from "@/lib/auth-errors";
import { completeSignIn } from "@/app/actions/auth";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

const createSignInSchema = (invalidEmail: string, invalidPassword: string) =>
  z.object({
    email: z.string().trim().email(invalidEmail),
    password: z.string().min(6, invalidPassword),
    rememberMe: z.boolean().optional(),
  });

type SignInValues = z.infer<ReturnType<typeof createSignInSchema>>;

export function SignInForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const [formErrorKey, setFormErrorKey] = useState<SignInErrorKey | null>(null);
  const t = useTranslations("auth.signIn");

  const callbackError = searchParams.get("error") === "auth_callback_failed";

  const signInSchema = useMemo(
    () => createSignInSchema(t("invalidEmail"), t("invalidPassword")),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      rememberMe: true,
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setFormErrorKey(null);

    if (typeof window !== "undefined") {
      localStorage.setItem("remember_me", data.rememberMe ? "true" : "false");
    }

    const supabase = createSupabaseClient();
    const normalizedEmail = data.email.trim().toLowerCase();

    try {
      const { data: signInData, error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: data.password,
        });

      if (error) {
        throw error;
      }

      useAuthStore.getState().setSession(signInData.session ?? null);
      queryClient.clear();

      // Single server round-trip: syncs the onboarding cookie (when eligible)
      // and resolves the authoritative role landing route from `profiles.role`.
      const { redirectPath } = await completeSignIn();

      toast.success(t("signInButton"));

      // Keep loading state active while Next.js transitions to the dashboard so
      // the button doesn't re-enable mid-navigation and trigger a duplicate
      // submission. Do not call `router.refresh()` in the same tick as
      // `router.replace()` — it races the in-flight navigation transition.
      router.replace(redirectPath);
    } catch (error: unknown) {
      const errorKey = mapSignInErrorKey(error);
      setFormErrorKey(errorKey);
      toast.error(t(errorKey));
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const activeErrorMessage = formErrorKey
    ? t(formErrorKey)
    : callbackError
      ? t("authCallbackFailed")
      : null;

  return (
    <motion.form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 font-sans"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {activeErrorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium leading-snug">{activeErrorMessage}</p>
            {formErrorKey === "invalidCredentials" && (
              <Link
                href="/forgot-password"
                className="inline-block underline underline-offset-2 hover:opacity-80"
              >
                {t("forgotPassword")}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          className="bg-background border-primary text-foreground placeholder:text-muted focus-visible:border-primary focus-visible:ring-primary/30"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-2 py-1">
        <input
          id="rememberMe"
          type="checkbox"
          className="h-4 w-4 rounded-md border border-border bg-card accent-primary cursor-pointer"
          {...register("rememberMe")}
        />
        <Label
          htmlFor="rememberMe"
          className="text-xs font-normal text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        >
          {t("rememberMe")}
        </Label>
      </div>

      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="w-full"
      >
        <Button
          type="submit"
          className="w-full text-sm mt-2"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("signInButton")}
        </Button>
      </motion.div>
    </motion.form>
  );
}
