"use client";

import { Link } from "@/i18n/routing";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Users,
  UserCog,
  CalendarDays,
  Stethoscope,
  Receipt,
  Settings,
  Pill,
  ClipboardList,
  FlaskConical,
  ChevronLeft,
  Activity,
  User,
  Building,
  Shield,
  KeyRound,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ResolvedNavItem } from "@/components/layout/nav.config";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  doctors: Stethoscope,
  staff: UserCog,
  patients: Users,
  appointments: CalendarDays,
  billing: Receipt,
  clinic: Building,
  settings: Settings,
  prescriptions: Pill,
  labOrders: FlaskConical,
  checkin: ClipboardList,
  profile: User,
  roles: Shield,
  users: Users,
  permissions: KeyRound,
  audit: ScrollText,
};

export function Sidebar({
  role = "admin",
  items = [],
}: {
  role?: string;
  items?: ResolvedNavItem[];
}) {
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebarStore();
  const t = useTranslations();

  const baseUrl = `/${role}`;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-background transition-all duration-300",
        isOpen ? "w-64" : "w-16",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href={baseUrl} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          {isOpen && (
            <span className="text-lg font-semibold tracking-tight text-foreground font-inter">
              {t("brand.name")}
            </span>
          )}
        </Link>
        <Button
          variant="secondary"
          size="icon"
          onClick={toggle}
          className="h-8 w-8"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              !isOpen && "rotate-180",
            )}
          />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="flex flex-col gap-1 px-2">
          {items.map((item) => {
            const Icon = ICONS[item.iconKey] ?? Activity;
            const isActive =
              pathname === item.href ||
              (item.href !== baseUrl && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors font-inter",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  !isOpen && "justify-center px-2",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isOpen && <span>{t(item.titleKey)}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="p-4">
        {isOpen && (
          <p className="text-xs text-muted-foreground text-center font-inter">
            © 2026 {t("brand.name")}
          </p>
        )}
      </div>
    </aside>
  );
}