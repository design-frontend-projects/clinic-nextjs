import { requireAuthenticatedTenant } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { hasFeature } from "@/lib/features";
import { resolveNavItems, type ResolvedNavItem } from "@/components/layout/nav.config";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PreferencesBootstrap } from "@/features/settings/components/PreferencesBootstrap";
import { OfflineProvider } from "@/lib/offline/offline-context";
import { settingsService } from "@/features/settings/services/settings.service";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role = "staff";
  let navItems: ResolvedNavItem[] = [];
  let userTheme: string | null = null;
  let userLanguage: string | null = null;
  let clinicId: string | null = null;
  let userId: string | null = null;

  try {
    const tenant = await requireAuthenticatedTenant();
    role = tenant.role || "staff";
    clinicId = tenant.clinicId ?? null;
    userId = tenant.userId ?? null;
    navItems = await resolveNavItems(role, hasPermission, hasFeature);

    // Cross-device user preferences (only values the user explicitly set).
    if (tenant.clinicId) {
      try {
        const resolved = await settingsService.getResolvedSettings(tenant.clinicId, tenant.profileId);
        const userSet = resolved.filter((setting) => setting.source === "user");
        userTheme = (userSet.find((s) => s.key === "preferences.theme")?.value as string) ?? null;
        userLanguage =
          (userSet.find((s) => s.key === "localization.default_language")?.value as string) ?? null;
      } catch {
        // Settings tables not migrated yet — preferences bootstrap is optional.
      }
    }
  } catch {
    // Unauthenticated render: no nav is shown. Route guards handle redirects.
    navItems = [];
  }

  const content = (
    <>
      <PreferencesBootstrap theme={userTheme} language={userLanguage} />
      {children}
    </>
  );

  return (
    <DashboardShell role={role} items={navItems}>
      {clinicId && userId ? (
        <OfflineProvider clinicId={clinicId} userId={userId}>
          {content}
        </OfflineProvider>
      ) : (
        content
      )}
    </DashboardShell>
  );
}
