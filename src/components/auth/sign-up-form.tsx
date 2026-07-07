"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signUpAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

const signUpSchema = z.object({
  fullName: z.string().min(2, ""),
  email: z.string().email(""),
  password: z.string().min(6, ""),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("auth.signUp");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignUpValues) => {
    setIsLoading(true);
    try {
      const result = await signUpAction({
        ...data,
        origin: window.location.origin,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.requiresEmailConfirmation) {
        toast.success(t("accountCreated"));
      } else {
        toast.success(t("accountCreatedRedirect"));
        router.push("/onboarding");
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message || t("createAccountButton"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-white">
          {t("fullNameLabel")}
        </Label>
        <Input
          id="fullName"
          type="text"
          placeholder={t("fullNamePlaceholder")}
          className="bg-[#181818] border-[#222222] text-white placeholder:text-[#666666] focus-visible:border-[#0007cd] focus-visible:ring-[#0007cd]/30"
          {...register("fullName")}
        />
        {errors.fullName && (
          <p className="text-xs text-red-400">{errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-white">
          {t("emailLabel")}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          className="bg-[#181818] border-[#222222] text-white placeholder:text-[#666666] focus-visible:border-[#0007cd] focus-visible:ring-[#0007cd]/30"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-white">
          {t("passwordLabel")}
        </Label>
        <Input
          id="password"
          type="password"
          placeholder={t("passwordPlaceholder")}
          className="bg-[#181818] border-[#222222] text-white placeholder:text-[#666666] focus-visible:border-[#0007cd] focus-visible:ring-[#0007cd]/30"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#0007cd] text-white hover:bg-[#0005a3] border-none text-sm font-medium mt-2"
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("createAccountButton")}
      </Button>
    </form>
  );
}
