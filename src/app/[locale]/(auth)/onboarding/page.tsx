import { getLocale } from "next-intl/server";
import { Metadata } from "next";
import { redirect } from "@/i18n/routing";
import { getSupabaseSession } from "@/lib/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = {
  title: "Onboarding - Clinic Pro",
  description: "Complete your clinic setup",
};

export default async function OnboardingPage() {
  const session = await getSupabaseSession();

  if (!session) {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  // Guard: Verify that a profiles record exists for the authenticated user
  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.profiles.findUnique({
    where: { auth_user_id: session.user.id },
  });

  if (!profile) {
    // If no profile exists, the sign-up profile creation step failed or was bypassed
    return redirect({ href: "/sign-up?error=profile_missing", locale: await getLocale() });
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-card border border-border p-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-inter">
            Welcome to Clinic Pro
          </h2>
          <p className="text-sm text-muted-foreground font-inter">
            Lets set up your profile and clinic workspace
          </p>
        </div>
        <OnboardingForm
          defaultEmail={session.user.email ?? undefined}
          defaultFullName={session.user.user_metadata?.full_name ?? undefined}
        />
      </div>
    </div>
  );
}
