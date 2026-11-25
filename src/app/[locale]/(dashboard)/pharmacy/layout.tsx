import { getLocale } from "next-intl/server";
import { resolveDashboardTenant } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { NoClinicNotice } from "@/components/dashboard/no-clinic-notice";
import { TenantAccessBlocked } from "@/components/dashboard/tenant-access-blocked";

export default async function PharmacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await resolveDashboardTenant();

  if (result.status === "unauthenticated") {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }
  if (result.status === "blocked") {
    return <TenantAccessBlocked access={result.access} />;
  }
  if (result.status === "no-clinic") {
    return <NoClinicNotice />;
  }

  const { tenant } = result;
  if (tenant.role !== "admin" && tenant.role !== "pharmacist" && tenant.role !== "doctor") {
    return redirect({ href: `/${tenant.role || ""}`, locale: await getLocale() });
  }

  return <>{children}</>;
}
