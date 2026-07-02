import { requireAppOwner } from "@/lib/app-owner-auth";
import { AppOwnerSidebar } from "@/components/app-owner/sidebar";

export default async function AppOwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure the user is an app owner
  await requireAppOwner();

  return (
    <div className="flex min-h-screen bg-muted/40 w-full">
      <AppOwnerSidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <div className="w-full flex-1">
            <h1 className="font-semibold text-lg">Platform Administration</h1>
          </div>
        </header>
        <div className="flex-1 p-4 lg:p-6 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
