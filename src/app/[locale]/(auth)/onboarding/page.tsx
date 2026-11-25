import { getLocale } from "next-intl/server";
import { Metadata } from "next";
import { redirect } from "@/i18n/routing";
import { getSupabaseSession } from "@/lib/auth";
import {
  canRunClinicOnboarding,
  extractActiveRbacRoleNames,
  resolveEffectiveProfileRole,
} from "@/lib/role-resolution";
import { roleHomePath } from "@/lib/role-routes";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Onboarding - Clinic Pro",
  description: "Complete your clinic setup",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const session = await getSupabaseSession();
  const t = await getTranslations("auth.onboarding");
  const { plan } = await searchParams;
  const initialPlanId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      plan ?? "",
    )
      ? plan
      : undefined;

  if (!session) {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  const locale = await getLocale();
  const { prisma } = await import("@/lib/prisma");
  const [profile, primaryClinic] = await Promise.all([
    prisma.profiles.findUnique({
      where: { auth_user_id: session.user.id },
      select: {
        id: true,
        role: true,
        is_profile_completed: true,
        user_roles: {
          where: { is_active: true, deleted_at: null },
          select: {
            roles: {
              select: {
                name: true,
                is_active: true,
                deleted_at: true,
              },
            },
          },
        },
      },
    }),
    prisma.clinics.findFirst({
      where: { auth_user_id: session.user.id, is_primary: true },
      select: { onboarding_completed_at: true },
    }),
  ]);

  if (!profile) {
    return redirect({
      href: "/sign-up?error=profile_missing",
      locale,
    });
  }

  const effectiveRole = resolveEffectiveProfileRole(
    profile.role,
    extractActiveRbacRoleNames(profile.user_roles),
  );

  if (!canRunClinicOnboarding(effectiveRole)) {
    return redirect({
      href: roleHomePath(effectiveRole),
      locale,
    });
  }

  if (profile.is_profile_completed && primaryClinic?.onboarding_completed_at) {
    return redirect({
      href: "/admin",
      locale,
    });
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-4 py-12 sm:px-6 lg:px-8">
      <div className="nvidia-corner-accent w-full max-w-md space-y-6 rounded-[var(--radius-card)] border border-hairline bg-card p-8 shadow-[var(--shadow-elevated)]">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {session.user.user_metadata?.full_name
              ? `${session.user.user_metadata?.full_name}, `
              : ""}
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <OnboardingForm
          defaultEmail={session.user.email ?? undefined}
          defaultFullName={session.user.user_metadata?.full_name ?? undefined}
          initialPlanId={initialPlanId}
        />
      </div>
    </div>
  );
}
