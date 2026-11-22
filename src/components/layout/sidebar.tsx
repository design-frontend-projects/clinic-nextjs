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
  ShieldCheck,
  MessageCircle,
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
  insurance: ShieldCheck,
  messages: MessageCircle,
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
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link
          href={baseUrl}
          className="flex items-center gap-2.5"
          onClick={onNavigate}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          {expanded && (
            <span className="text-base font-bold tracking-tight text-foreground">
              {t("brand.name")}
            </span>
          )}
        </Link>
        {showCollapseButton && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Toggle sidebar"
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
      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-0.5 px-2.5">
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
                title={!expanded ? t(item.titleKey) : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[var(--radius-input)] px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-surface text-foreground shadow-[var(--shadow-soft)] dark:bg-sidebar-accent dark:text-foreground dark:font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  !expanded && "justify-center px-2",
                )}
              >
                {isActive && (
                  <span
                    className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary dark:rounded-none"
                    aria-hidden
                  />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {expanded && <span className="truncate">{t(item.titleKey)}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <Separator className="bg-sidebar-border" />
      <div className="p-3.5">
        {expanded && (
          <p className="text-center text-xs text-muted-foreground">
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
          "fixed inset-y-0 inset-s-0 z-40 hidden h-screen flex-col border-e border-sidebar-border bg-sidebar transition-all duration-300 lg:flex",
          isOpen ? "w-64" : "w-16",
        )}
      >
        <SidebarNav
          role={role}
          items={items}
          expanded={isOpen}
          showCollapseButton
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={locale === "ar" ? "right" : "left"}
          className="w-72 border-sidebar-border bg-sidebar p-0 lg:hidden"
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
