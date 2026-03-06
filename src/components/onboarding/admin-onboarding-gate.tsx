"use client";

import { OnboardingDialog } from "./onboarding-dialog";

type AdminOnboardingGateProps = {
  needsOnboarding: boolean;
  defaultEmail?: string;
  defaultFullName?: string;
  children: React.ReactNode;
};

/**
 * Client component that wraps admin content.
 * If the user hasn't completed onboarding (no clinic_id),
 * shows the onboarding dialog instead of the admin dashboard.
 */
export function AdminOnboardingGate({
  needsOnboarding,
  defaultEmail,
  defaultFullName,
  children,
}: AdminOnboardingGateProps) {
  if (needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-primary/5 via-background to-primary/10">
        <OnboardingDialog
          open={true}
          defaultEmail={defaultEmail}
          defaultFullName={defaultFullName}
        />
      </div>
    );
  }

  return <>{children}</>;
}
