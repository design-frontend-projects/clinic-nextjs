"use client";
import { motion } from "framer-motion";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

const signInSchema = z.object({
  email: z.string().email(""),
  password: z.string().min(6, ""),
  rememberMe: z.boolean().optional(),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("auth.signIn");

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
    setIsLoading(true);

    if (typeof window !== "undefined") {
      localStorage.setItem("remember_me", data.rememberMe ? "true" : "false");
    }

    const supabase = createSupabaseClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      useAuthStore.getState().setSession(session);

      const roles = useAuthStore.getState().getRoles();
      const isAppOwner = roles.includes("app_owner");
      const isStaff = roles.includes("staff");
      const redirectPath = isAppOwner
        ? "/dashboard/app-owner"
        : isStaff
          ? "/dashboard/staff"
          : "/dashboard/admin";

      toast.success(t("signInButton"));
      console.log("i will redirect to: ", redirectPath);

      router.refresh();
      router.push(redirectPath);
      console.log("redirect done success");
    } catch (error: any) {
      toast.error(error.message || t("signInButton"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 font-sans"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white">
          {t("emailLabel")}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          className="bg-background border-primary text-foreground placeholder:text-muted focus-visible:border-primary focus-visible:ring-primary/30"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-white">
            {t("passwordLabel")}
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-[#a8a8a8] hover:text-white hover:underline transition-colors"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder={t("passwordPlaceholder")}
          className="bg-background border-primary text-foreground placeholder:text-muted focus-visible:border-primary focus-visible:ring-primary/30"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-2 py-1">
        <input
          id="rememberMe"
          type="checkbox"
          className="h-4 w-4 rounded-[4px] border border-[#333333] bg-[#222222] text-[#0007cd] focus:ring-0 focus:ring-offset-0 focus:ring-[#0007cd] accent-[#0007cd] cursor-pointer"
          {...register("rememberMe")}
        />
        <Label
          htmlFor="rememberMe"
          className="text-xs font-normal text-[#a8a8a8] cursor-pointer hover:text-white transition-colors"
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
          className="w-full bg-primary text-white hover:bg-primary/90 border-none text-sm font-medium mt-2"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("signInButton")}
        </Button>
      </motion.div>
    </motion.form>
  );
}
