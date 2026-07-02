import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseSession } from "@/lib/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = {
  title: "Onboarding - Clinic Pro",
  description: "Complete your clinic setup",
};

export default async function OnboardingPage() {
  const session = await getSupabaseSession();
  
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-card border border-border p-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-inter">
            Welcome to Clinic Pro
          </h2>
          <p className="text-sm text-muted-foreground font-inter">
            Let's set up your profile and clinic workspace
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
