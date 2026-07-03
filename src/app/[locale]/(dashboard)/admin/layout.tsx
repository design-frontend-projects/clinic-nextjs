import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getTenantInfo } from "@/lib/auth";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenantInfo();
  console.log("tenant data here: ", tenant);
  if (!tenant) {
    console.log("i am here, to sign in");
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  if (tenant.role !== "admin") {
    return redirect({ href: "/", locale: await getLocale() });
  }

  return <>{children}</>;
}
