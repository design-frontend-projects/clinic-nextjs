import { getLocale } from "next-intl/server";
import { requireTenantInfo } from "@/lib/auth";
import { redirect } from "@/i18n/routing";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const tenant = await requireTenantInfo();
    if (
      tenant.role !== "admin" &&
      tenant.role !== "receptionist" &&
      tenant.role !== "staff"
    ) {
      return redirect({ href: `/${tenant.role || ""}`, locale: await getLocale() });
    }
  } catch {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  return <>{children}</>;
}
