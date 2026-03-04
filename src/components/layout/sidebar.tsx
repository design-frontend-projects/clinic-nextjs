"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
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
  admin: [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { title: "Doctors", href: "/admin/doctors", icon: Stethoscope },
    { title: "Staff", href: "/admin/staff", icon: UserCog },
    { title: "Patients", href: "/admin/patients", icon: Users },
    { title: "Appointments", href: "/admin/appointments", icon: CalendarDays },
    { title: "Billing", href: "/admin/billing", icon: Receipt },
    { title: "Pharmacy", href: "/admin/pharmacy", icon: Pill },
    { title: "Lab Orders", href: "/admin/lab-orders", icon: FlaskConical },
    { title: "Inventory", href: "/admin/inventory", icon: Package },
    { title: "Reports", href: "/admin/reports", icon: ClipboardList },
    { title: "Clinic Definition", href: "/admin/clinics", icon: Building },
    { title: "Settings", href: "/admin/settings", icon: Settings },
  ],
  doctor: [
    { title: "Dashboard", href: "/doctor", icon: LayoutDashboard },
    {
      title: "My Appointments",
      href: "/doctor/appointments",
      icon: CalendarDays,
    },
    { title: "My Patients", href: "/doctor/patients", icon: Users },
    { title: "Prescriptions", href: "/doctor/prescriptions", icon: Pill },
    { title: "Lab Orders", href: "/doctor/lab-orders", icon: FlaskConical },
    { title: "Profile", href: "/doctor/profile", icon: User },
  ],
  staff: [
    { title: "Dashboard", href: "/staff", icon: LayoutDashboard },
    { title: "Appointments", href: "/staff/appointments", icon: CalendarDays },
    { title: "Patients", href: "/staff/patients", icon: Users },
    { title: "Check-in Queue", href: "/staff/checkin", icon: ClipboardList },
    { title: "Billing", href: "/staff/billing", icon: Receipt },
  ],
};

export function Sidebar({ role = "admin" }: { role?: string }) {
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebarStore();

  const navItems = navConfig[role as keyof typeof navConfig] || navConfig.admin;
  const baseUrl = `/${role}`;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card transition-all duration-300",
        isOpen ? "w-64" : "w-16",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link href={baseUrl} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          {isOpen && (
            <span className="text-lg font-bold tracking-tight">ClinicPro</span>
          )}
        </Link>
        <Button
          variant="ghost"
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
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
          <p className="text-xs text-muted-foreground text-center">
            © 2026 ClinicPro
          </p>
        )}
      </div>
    </aside>
  );
}
