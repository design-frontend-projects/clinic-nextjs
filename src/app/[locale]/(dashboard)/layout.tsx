import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { requireAuthenticatedTenant } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { resolveNavItems, type ResolvedNavItem } from "@/components/layout/nav.config";

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
    <div className="min-h-screen bg-canvas dark">
      <Sidebar role={role} items={navItems} />
      <Header />
      <main className="ml-64 p-6 transition-all duration-300 data-[collapsed=true]:ml-16">
        {children}
      </main>
    </div>
  );
}
