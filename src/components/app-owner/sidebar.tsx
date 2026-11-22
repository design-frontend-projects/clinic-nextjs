"use client";

import { Link } from "@/i18n/routing";
import { usePathname } from "@/i18n/routing";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  Stethoscope,
  Pill,
  Bell,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const navItems = [
  {
    titleKey: "dashboard",
    href: "/app-owner",
    icon: LayoutDashboard,
  },
  {
    titleKey: "tenants",
    href: "/app-owner/tenants",
    icon: Building2,
  },
  {
    titleKey: "plans",
    href: "/app-owner/plans",
    icon: CreditCard,
  },
  {
    titleKey: "specialties",
    href: "/app-owner/specialties",
    icon: Stethoscope,
  },
  {
    titleKey: "medications",
    href: "/app-owner/medications",
    icon: Pill,
  },
  {
    titleKey: "notifications",
    href: "/app-owner/notifications",
    icon: Bell,
  },
] as const;

export function AppOwnerSidebar() {
  const pathname = usePathname();
  const t = useTranslations("appOwner.sidebar");

  return (
    <aside className="flex min-h-screen w-64 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-button)] bg-primary text-primary-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <span className="font-bold tracking-tight text-foreground">
          {t("appOwnerTitle")}
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app-owner" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-[var(--radius-input)] px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-surface text-foreground shadow-[var(--shadow-soft)] dark:bg-sidebar-accent dark:font-semibold"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              {isActive && (
                <span
                  className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary dark:rounded-none"
                  aria-hidden
                />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {t(item.titleKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
