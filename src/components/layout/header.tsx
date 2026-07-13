"use client";

import { useSidebarStore } from "@/stores/sidebar-store";
import { Menu, Moon, Sun, LogOut, User, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useLocaleSwitcher } from "@/components/providers/intl-provider";

import { useQuery } from "@tanstack/react-query";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { BranchSelector } from "./branch-selector";
import { BranchDisplay } from "./branch-display";
import { DoctorLocationSelector } from "./doctor-location-selector";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Header() {
  const { setMobileOpen } = useSidebarStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const locale = useLocale();
  const { switchLocale } = useLocaleSwitcher();
  const t = useTranslations();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  const toggleLanguage = () => {
    void switchLocale(locale === "en" ? "ar" : "en");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur supports-backdrop-filter:bg-background/60 transition-all duration-300">
      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {tenant?.clinicId && (
          <div className="hidden md:block">
            {tenant.role === "doctor" ? (
              <DoctorLocationSelector
                activeClinicId={tenant.clinicId}
                activeBranchId={tenant.branchId}
                clinicName={tenant.clinicName}
                branchName={tenant.branchName}
              />
            ) : tenant.branchLocked ? (
              <BranchDisplay
                clinicName={tenant.clinicName}
                branchName={tenant.branchName}
              />
            ) : (
              <BranchSelector
                clinicId={tenant.clinicId}
                currentBranchId={tenant.branchId}
              />
            )}
          </div>
        )}

        <div className="hidden sm:block">
          <h2 className="text-lg font-semibold text-foreground font-inter">
            {t("header.welcomeBack")}
          </h2>
          <p className="text-sm text-muted-foreground font-inter">
            {t("header.manageClinic")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language Toggle */}
        <Button
          variant="secondary"
          size="icon"
          onClick={toggleLanguage}
          className="h-9 w-9"
          title={locale === "en" ? "Arabic" : "English"}
        >
          <Globe className="h-4 w-4" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full overflow-hidden">
              <Avatar className="h-9 w-9">
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                {tenant?.fullName && (
                  <p className="font-medium text-foreground">{tenant.fullName}</p>
                )}
                {tenant?.email && (
                  <p className="w-[200px] truncate text-sm text-muted-foreground">
                    {tenant.email}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
              <LogOut className="me-2 h-4 w-4" />
              <span>{t("header.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}