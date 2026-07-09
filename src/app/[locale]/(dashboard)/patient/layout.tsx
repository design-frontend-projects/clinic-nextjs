import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { resolveDashboardTenant } from "@/lib/auth";
import { NoClinicNotice } from "@/components/dashboard/no-clinic-notice";

export default async function PatientLayout({
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
  if (tenant.role !== "patient") {
    return redirect({ href: "/", locale: await getLocale() });
  }

  return <>{children}</>;
}
