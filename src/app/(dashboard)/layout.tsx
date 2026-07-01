import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { requireAuthenticatedTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role = "admin";
  try {
    const tenant = await requireAuthenticatedTenant();
    
    role = tenant.role || "admin";
  } catch {
    // defaults to admin for safe UI render when bypassing
  }

  return (
    <div className="min-h-screen bg-canvas dark">
      <Sidebar role={role} />
      <Header />
      <main className="ml-64 p-6 transition-all duration-300 data-[collapsed=true]:ml-16">
        {children}
      </main>
    </div>
  );
}