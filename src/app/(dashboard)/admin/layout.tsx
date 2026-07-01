import { redirect } from "next/navigation";
import { requireTenantInfo } from "@/lib/auth";
import { AdminOnboardingGate } from "@/components/onboarding/admin-onboarding-gate";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireTenantInfo();

  if (tenant.role !== "admin") {
    redirect("/");
  }

  const needsOnboarding = !tenant.is_profile_completed;

  return (
    <AdminOnboardingGate
      needsOnboarding={needsOnboarding}
      defaultEmail={tenant.email ?? undefined}
      defaultFullName={tenant.fullName ?? undefined}
    >
      {children}
    </AdminOnboardingGate>
  );
}
