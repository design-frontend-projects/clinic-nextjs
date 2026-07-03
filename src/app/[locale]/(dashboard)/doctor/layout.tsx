import { getLocale } from "next-intl/server";
import { requireTenantInfo } from "@/lib/auth";
import { redirect } from "@/i18n/routing";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireTenantInfo();

  if (tenant.role !== "doctor" && tenant.role !== "admin") {
    return redirect({ href: "/", locale: await getLocale() });
  }

  return <>{children}</>;
}
