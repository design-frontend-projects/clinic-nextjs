"use client";

import { useSidebarStore } from "@/stores/sidebar-store";
import { Menu, LogOut, User, Globe, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
import { openCommandPalette } from "@/components/layout/command-palette";

export function Header() {
  const { setMobileOpen } = useSidebarStore();
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-hairline bg-surface/95 px-4 backdrop-blur supports-backdrop-filter:bg-surface/85 transition-colors sm:px-6 dark:bg-canvas/95 dark:supports-backdrop-filter:bg-canvas/85">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden"
          aria-label={t("header.openMenu")}
        >
          <Menu className="h-4 w-4" />
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

        <div className="hidden xl:block">
          <h2 className="text-sm font-semibold text-foreground">
            {t("header.welcomeBack")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("header.manageClinic")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Command Palette Trigger */}
        <Button
          variant="secondary"
          size="sm"
          onClick={openCommandPalette}
          className="hidden h-9 w-52 justify-between px-3 text-muted-foreground sm:inline-flex"
        >
          <span className="flex items-center gap-2 text-xs">
            <Search className="h-3.5 w-3.5" />
            <span>{t("commandPalette.trigger")}</span>
          </span>
          <kbd className="rounded-[var(--radius-input)] border border-hairline bg-canvas-soft px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={openCommandPalette}
          className="sm:hidden"
          aria-label={t("commandPalette.trigger")}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Language Toggle */}
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={toggleLanguage}
          title={locale === "en" ? "العربية" : "English"}
          aria-label={t("header.toggleLanguage")}
        >
          <Globe className="h-4 w-4" />
        </Button>

        {/* Theme Toggle (Notion Light ↔ NVIDIA Dark) */}
        <ThemeToggle variant="secondary" />

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              className="overflow-hidden rounded-full dark:rounded-[var(--radius-button)]"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-canvas-soft text-foreground dark:bg-surface-elevated">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                {tenant?.fullName && (
                  <p className="font-medium text-foreground">{tenant.fullName}</p>
                )}
                {tenant?.email && (
                  <p className="w-[200px] truncate text-xs text-muted-foreground">
                    {tenant.email}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              variant="destructive"
              className="cursor-pointer"
            >
              <LogOut className="me-2 h-4 w-4" />
              <span>{t("header.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
