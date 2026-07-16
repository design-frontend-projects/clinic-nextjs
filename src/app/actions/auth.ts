"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSupabaseSession, getTenantInfo } from "@/lib/auth";
import { roleHomePath, DEFAULT_HOME_PATH } from "@/lib/role-routes";
import * as z from "zod";

/**
 * After a successful sign-in, mark onboarding as complete for users who
 * already belong to a clinic. The middleware onboarding gate (src/proxy.ts)
 * keys off the `onboarding_complete` cookie, which is otherwise only set at
 * the end of the owner's onboarding wizard — so without this, an invited user
 * (or an owner whose tenant was provisioned by the app-owner, or a completed
 * owner on a fresh browser) is wrongly pushed into the onboarding flow.
 * Owners still mid-wizard (`is_profile_completed` false) are excluded so
 * their own onboarding resumes.
 */
export async function syncOnboardingCookie() {
  const tenant = await getTenantInfo();
  if (!tenant?.clinicId) return;
  if (tenant.is_owner && !tenant.is_profile_completed) return;

  const cookieStore = await cookies();
  cookieStore.set("onboarding_complete", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

/**
 * Resolve the dashboard landing path for the just-signed-in user from their
 * authoritative `profiles.role` (the same source every dashboard guard uses).
 *
 * The client sign-in form reads roles from the Supabase JWT (`app_metadata.roles`),
 * which is frequently empty and omits several roles — so it silently misroutes
 * everyone to `/admin`. Resolving server-side from the DB fixes that. Falls back
 * to the JWT claim, then `/admin`, when no profile is linked yet.
 */
export async function getPostSignInRedirect(): Promise<string> {
  const tenant = await getTenantInfo();
  if (tenant) {
    return roleHomePath(tenant.role);
  }

  // No profile row yet (e.g. mid-provisioning): fall back to the JWT claim.
  const session = await getSupabaseSession();
  const roles = session?.user?.app_metadata?.roles as string[] | undefined;
  const jwtRole = roles?.find((r) => roleHomePath(r) !== DEFAULT_HOME_PATH);
  return jwtRole ? roleHomePath(jwtRole) : DEFAULT_HOME_PATH;
}

const signUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  origin: z.string().url("Invalid origin URL"),
  planId: z.string().uuid().optional(),
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

    // encodeURIComponent keeps `plan` inside the `next` value; unencoded it
    // would become a sibling query param of the callback URL and be dropped.
    const next = parsedData.planId
      ? `/onboarding?plan=${parsedData.planId}`
      : "/onboarding";

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsedData.email,
      password: parsedData.password,
      options: {
        data: {
          full_name: parsedData.fullName,
        },
        emailRedirectTo: `${parsedData.origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
