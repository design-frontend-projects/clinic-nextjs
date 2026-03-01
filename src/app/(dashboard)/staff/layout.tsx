import { requireTenantInfo } from "@/lib/auth";
import { redirect } from "next/navigation";

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
      redirect(`/${tenant.role || ""}`);
    }
  } catch {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
