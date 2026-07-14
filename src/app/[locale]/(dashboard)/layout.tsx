import { requireAuthenticatedTenant } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { resolveNavItems, type ResolvedNavItem } from "@/components/layout/nav.config";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OfflineProvider } from "@/lib/offline/offline-context";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role = "staff";
  let navItems: ResolvedNavItem[] = [];
  let clinicId: string | null = null;
  let userId: string | null = null;

  try {
    const tenant = await requireAuthenticatedTenant();
    role = tenant.role || "staff";
    clinicId = tenant.clinicId ?? null;
    userId = tenant.userId ?? null;
    navItems = await resolveNavItems(role, hasPermission);
  } catch {
    // Unauthenticated render: no nav is shown. Route guards handle redirects.
    navItems = [];
  }

  return (
    <DashboardShell role={role} items={navItems}>
      {clinicId && userId ? (
        <OfflineProvider clinicId={clinicId} userId={userId}>
          {children}
        </OfflineProvider>
      ) : (
        children
      )}
    </DashboardShell>
  );
}
