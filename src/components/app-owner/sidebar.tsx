"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Building2, 
  CreditCard, 
  Settings, 
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Dashboard",
    href: "/app-owner",
    icon: LayoutDashboard,
  },
  {
    title: "Tenants",
    href: "/app-owner/tenants",
    icon: Building2,
  },
  {
    title: "Subscription Plans",
    href: "/app-owner/plans",
    icon: CreditCard,
  },
  {
    title: "Global Settings",
    href: "/app-owner/settings",
    icon: Settings,
  },
];

export function AppOwnerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-background flex flex-col min-h-screen">
      <div className="h-14 border-b flex items-center px-6 lg:h-[60px]">
        <span className="font-bold tracking-tight">App Owner</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/app-owner" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
