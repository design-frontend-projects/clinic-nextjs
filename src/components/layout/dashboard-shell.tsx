"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { ResolvedNavItem } from "@/components/layout/nav.config";

type DashboardShellProps = {
  role: string;
  items: ResolvedNavItem[];
  children: React.ReactNode;
};

export function DashboardShell({ role, items, children }: DashboardShellProps) {
  const isOpen = useSidebarStore((state) => state.isOpen);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar role={role} items={items} />
      <div
        className={cn(
          "transition-[margin] duration-300",
          isOpen ? "lg:ms-64" : "lg:ms-16",
        )}
      >
        <Header />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
