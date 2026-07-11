"use client";

import { Link } from "@/i18n/routing";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useTranslations, useLocale } from "next-intl";
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
  Star,
  SlidersHorizontal,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
  reviews: Star,
  preferences: SlidersHorizontal,
  notifications: Bell,
};

type SidebarNavProps = {
  role: string;
  items: ResolvedNavItem[];
  expanded: boolean;
  showCollapseButton?: boolean;
  onNavigate?: () => void;
};

function SidebarNav({
  role,
  items,
  expanded,
  showCollapseButton = false,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();
  const { toggle, isOpen } = useSidebarStore();
  const t = useTranslations();

  // Owners use the admin dashboard; there is no /owner route group.
  const baseUrl = role === "owner" ? "/admin" : `/${role}`;

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href={baseUrl} className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          {expanded && (
            <span className="text-lg font-semibold tracking-tight text-foreground font-inter">
              {t("brand.name")}
            </span>
          )}
        </Link>
        {showCollapseButton && (
          <Button
            variant="secondary"
            size="icon"
            onClick={toggle}
            className="h-8 w-8"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform rtl:rotate-180",
                !isOpen && "rotate-180 rtl:rotate-0",
              )}
            />
          </Button>
        )}
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
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors font-inter",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  !expanded && "justify-center px-2",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {expanded && <span>{t(item.titleKey)}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="p-4">
        {expanded && (
          <p className="text-xs text-muted-foreground text-center font-inter">
            © 2026 {t("brand.name")}
          </p>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  role = "admin",
  items = [],
}: {
  role?: string;
  items?: ResolvedNavItem[];
}) {
  const { isOpen, isMobileOpen, setMobileOpen } = useSidebarStore();
  const locale = useLocale();
  const t = useTranslations();

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          "fixed inset-y-0 inset-s-0 z-40 hidden lg:flex h-screen flex-col border-e border-border bg-sidebar transition-all duration-300",
          isOpen ? "w-64" : "w-16",
        )}
      >
        <SidebarNav role={role} items={items} expanded={isOpen} showCollapseButton />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={locale === "ar" ? "right" : "left"}
          className="w-72 p-0 lg:hidden"
        >
          <SheetTitle className="sr-only">{t("brand.name")}</SheetTitle>
          <SidebarNav
            role={role}
            items={items}
            expanded
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
