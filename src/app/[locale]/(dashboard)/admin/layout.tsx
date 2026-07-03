import { redirect } from "next/navigation";
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
    redirect("/sign-in");
  }

  if (tenant.role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}
