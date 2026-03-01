import { requireTenantInfo } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const tenant = await requireTenantInfo();
    if (tenant.role !== "admin" && tenant.role !== "doctor") {
      redirect(`/${tenant.role || ""}`);
    }
  } catch {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
