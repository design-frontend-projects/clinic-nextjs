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
  Package,
  FlaskConical,
  ChevronLeft,
  Activity,
  User,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const navConfig = {
  admin: (t: any) => [
    { title: t("sidebar.dashboard"), href: "/admin", icon: LayoutDashboard },
    { title: t("sidebar.doctors"), href: "/admin/doctors", icon: Stethoscope },
    { title: t("sidebar.staff"), href: "/admin/staff", icon: UserCog },
    { title: t("sidebar.patients"), href: "/admin/patients", icon: Users },
    { title: t("sidebar.appointments"), href: "/admin/appointments", icon: CalendarDays },
    { title: t("sidebar.billing"), href: "/admin/billing", icon: Receipt },
    { title: t("sidebar.pharmacy"), href: "/admin/pharmacy", icon: Pill },
    { title: t("sidebar.labOrders"), href: "/admin/lab-orders", icon: FlaskConical },
    { title: t("sidebar.inventory"), href: "/admin/inventory", icon: Package },
    { title: t("sidebar.reports"), href: "/admin/reports", icon: ClipboardList },
    { title: t("sidebar.clinicDefinition"), href: "/admin/clinics", icon: Building },
    { title: t("sidebar.settings"), href: "/admin/settings", icon: Settings },
  ],
  doctor: (t: any) => [
    { title: t("sidebar.dashboard"), href: "/doctor", icon: LayoutDashboard },
    { title: t("pages.doctor.myAppointments"), href: "/doctor/appointments", icon: CalendarDays },
    { title: t("pages.doctor.myPatients"), href: "/doctor/patients", icon: Users },
    { title: t("pages.doctor.prescriptions"), href: "/doctor/prescriptions", icon: Pill },
    { title: t("pages.doctor.labOrders"), href: "/doctor/lab-orders", icon: FlaskConical },
    { title: t("pages.doctor.profile"), href: "/doctor/profile", icon: User },
  ],
  staff: (t: any) => [
    { title: t("sidebar.dashboard"), href: "/staff", icon: LayoutDashboard },
    { title: t("pages.staff.appointments"), href: "/staff/appointments", icon: CalendarDays },
    { title: t("pages.staff.patients"), href: "/staff/patients", icon: Users },
    { title: t("sidebar.checkinQueue"), href: "/staff/checkin", icon: ClipboardList },
    { title: t("pages.staff.billing"), href: "/staff/billing", icon: Receipt },
  ],
};

export function Sidebar({ role = "admin" }: { role?: string }) {
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebarStore();
  const t = useTranslations();

  const navItems = (role === "admin" ? navConfig.admin : role === "doctor" ? navConfig.doctor : navConfig.staff)(t);
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
          {navItems.map((item) => {
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
                <item.icon className="h-5 w-5 shrink-0" />
                {isOpen && <span>{item.title}</span>}
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