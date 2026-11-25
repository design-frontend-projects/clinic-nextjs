import { getLocale } from "next-intl/server";
import { resolveDashboardTenant } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { NoClinicNotice } from "@/components/dashboard/no-clinic-notice";
import { TenantAccessBlocked } from "@/components/dashboard/tenant-access-blocked";

const ALLOWED_BOOKING_ROLES = new Set([
  "admin",
  "owner",
  "super_admin",
  "staff",
  "receptionist",
  "doctor",
  "patient",
]);

export default async function BookingLayout({
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
  if (result.status === "app-owner") {
    return redirect({ href: "/app-owner", locale: await getLocale() });
  }
  if (result.status === "no-clinic") {
    return <NoClinicNotice />;
  }

  const { tenant } = result;
  if (!ALLOWED_BOOKING_ROLES.has(tenant.role)) {
    return redirect({ href: `/${tenant.role || ""}`, locale: await getLocale() });
  }

  return <>{children}</>;
}
