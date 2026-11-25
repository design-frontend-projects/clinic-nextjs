"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { GracePeriodBanner } from "@/components/layout/grace-period-banner";
import { CommandPalette } from "@/components/layout/command-palette";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { ResolvedNavItem } from "@/components/layout/nav.config";
import type { TenantAccessWarning } from "@/lib/tenant-access";

type DashboardShellProps = {
  role: string;
  items: ResolvedNavItem[];
  graceWarning?: TenantAccessWarning | null;
  children: React.ReactNode;
};

export function DashboardShell({
  role,
  items,
  graceWarning,
  children,
}: DashboardShellProps) {
  const isOpen = useSidebarStore((state) => state.isOpen);

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <CommandPalette items={items} />
      <Sidebar role={role} items={items} />
      <div
        className={cn(
          "transition-[margin] duration-300",
          isOpen ? "lg:ms-64" : "lg:ms-16",
        )}
      >
        <OfflineBanner />
        {graceWarning && <GracePeriodBanner warning={graceWarning} />}
        <Header />
        <main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
