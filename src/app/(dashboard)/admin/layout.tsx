import { requireTenantInfo } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const tenant = await requireTenantInfo();
    console.log("tenant data here");
    console.log(tenant);

    if (tenant.role !== "admin") {
      redirect(`/${tenant.role || ""}`);
    }
  } catch {
    redirect("/sign-up");
  }

  return <>{children}</>;
}
