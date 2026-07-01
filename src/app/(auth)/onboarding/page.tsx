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
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Welcome to Clinic Pro
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Let's set up your clinic profile
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
