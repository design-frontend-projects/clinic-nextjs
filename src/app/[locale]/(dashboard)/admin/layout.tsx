import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { resolveDashboardTenant } from "@/lib/auth";
import { NoClinicNotice } from "@/components/dashboard/no-clinic-notice";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await resolveDashboardTenant();

  if (result.status === "unauthenticated") {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }
  if (result.status === "no-clinic") {
    return <NoClinicNotice />;
  }

  const { tenant } = result;
  // Owners and super admins are the tenant super-users (same bypass tier as
  // admin in lib/rbac) and manage the clinic from the admin dashboard.
  if (
    tenant.role !== "admin" &&
    tenant.role !== "owner" &&
    tenant.role !== "super_admin"
  ) {
    return redirect({ href: "/", locale: await getLocale() });
  }

  return <>{children}</>;
}
