"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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
    }
  });

  const onSubmit = async (data: SignInValues) => {
    setIsLoading(true);
    
    // Save Remember Me preference
    if (typeof window !== "undefined") {
      localStorage.setItem("remember_me", data.rememberMe ? "true" : "false");
    }

    // Initialize Supabase Client with current persistence choice
    const supabase = createSupabaseClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      // Get current session and store it in Zustand
      const { data: sessionData } = await supabase.auth.getSession();
      useAuthStore.getState().setSession(sessionData.session);

      toast.success("Successfully signed in");
      router.push("/dashboard");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="doctor@clinic.com"
          className="bg-[#181818] border-[#222222] text-white placeholder:text-[#666666] focus-visible:border-[#0007cd] focus-visible:ring-[#0007cd]/30"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-white">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-[#a8a8a8] hover:text-white hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          className="bg-[#181818] border-[#222222] text-white placeholder:text-[#666666] focus-visible:border-[#0007cd] focus-visible:ring-[#0007cd]/30"
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
          Remember me
        </Label>
      </div>

      <Button
        type="submit"
        className="w-full bg-[#0007cd] text-white hover:bg-[#0005a3] border-none text-sm font-medium mt-2"
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
