import { requireAuthenticatedTenant } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { resolveNavItems, type ResolvedNavItem } from "@/components/layout/nav.config";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role = "staff";
  let navItems: ResolvedNavItem[] = [];

  try {
    const tenant = await requireAuthenticatedTenant();
    role = tenant.role || "staff";
    navItems = await resolveNavItems(role, hasPermission);
  } catch {
    // Unauthenticated render: no nav is shown. Route guards handle redirects.
    navItems = [];
  }

  return (
    <DashboardShell role={role} items={navItems}>
      {children}
    </DashboardShell>
  );
}
