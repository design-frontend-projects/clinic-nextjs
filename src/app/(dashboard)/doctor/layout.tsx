import { requireTenantInfo } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireTenantInfo();

  if (tenant.role !== "doctor" && tenant.role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}
