import { requireAuthenticatedTenant } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminOnboardingGate } from "@/components/onboarding/admin-onboarding-gate";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let needsOnboarding = false;
  let defaultEmail: string | undefined;
  let defaultFullName: string | undefined;

  try {
    const tenant = await requireAuthenticatedTenant();
    needsOnboarding = !tenant.clinicId;
    defaultEmail = tenant.email ?? undefined;
    defaultFullName = tenant.fullName ?? undefined;
  } catch {
    // No tenant info → user not authenticated or no profile
    redirect("/sign-up");
  }

  return (
    <AdminOnboardingGate
      needsOnboarding={needsOnboarding}
      defaultEmail={defaultEmail}
      defaultFullName={defaultFullName}
    >
      {children}
    </AdminOnboardingGate>
  );
}
