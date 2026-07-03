"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  origin: z.string().url("Invalid origin URL"),
});

export type SignUpActionData = z.infer<typeof signUpSchema>;

export async function signUpAction(data: SignUpActionData) {
  try {
    const parsedData = signUpSchema.parse(data);

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              // Ignored in Server Action
            }
          },
        },
      },
    );

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsedData.email,
      password: parsedData.password,
      options: {
        data: {
          full_name: parsedData.fullName,
        },
        emailRedirectTo: `${parsedData.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (authError) {
      return { error: authError.message };
    }

    if (authData.user) {
      // Check if profile already exists to prevent unique constraint violations on retry
      const existingProfile = await prisma.profiles.findUnique({
        where: { auth_user_id: authData.user.id },
      });

      if (!existingProfile) {
        await prisma.profiles.create({
          data: {
            auth_user_id: authData.user.id,
            email: authData.user.email,
            full_name: parsedData.fullName,
            role: "admin",
            status: "active",
            is_profile_completed: false,
            is_owner: true,
          },
        });
      }
    }

    return {
      success: true,
      requiresEmailConfirmation: !authData.session,
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation error" };
    }
    console.error("Sign up action error:", error);
    return { error: "An unexpected error occurred during sign up." };
  }
}
