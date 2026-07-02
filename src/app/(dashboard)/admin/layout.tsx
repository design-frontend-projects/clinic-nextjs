import { redirect } from "next/navigation";
import { getTenantInfo } from "@/lib/auth";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenantInfo();

  if (!tenant) {
    redirect("/sign-in");
  }

  if (tenant.role !== "owner") {
    redirect("/");
  }

  return <>{children}</>;
}
