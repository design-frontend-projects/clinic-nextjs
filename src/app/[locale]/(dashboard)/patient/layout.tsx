import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getTenantInfo } from "@/lib/auth";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenantInfo();

  if (!tenant) {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  if (tenant.role !== "patient") {
    return redirect({ href: "/", locale: await getLocale() });
  }

  return <>{children}</>;
}
