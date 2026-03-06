import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminOnboardingGate } from "@/components/onboarding/admin-onboarding-gate";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_profile_completed, email, full_name")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const needsOnboarding = !profile.is_profile_completed;

  return (
    <AdminOnboardingGate
      needsOnboarding={needsOnboarding}
      defaultEmail={profile.email ?? undefined}
      defaultFullName={profile.full_name ?? undefined}
    >
      {children}
    </AdminOnboardingGate>
  );
}
