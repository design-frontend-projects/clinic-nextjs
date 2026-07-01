"use client";

import { useSidebarStore } from "@/stores/sidebar-store";
import { cn } from "@/lib/utils";
import { Menu, Bell, Moon, Sun, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { BranchSelector } from "./branch-selector";

export function Header() {
  const { isOpen, toggle } = useSidebarStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60 transition-all duration-300",
        isOpen ? "ml-64" : "ml-16",
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          size="icon"
          onClick={toggle}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {tenant?.clinicId && (
          <div className="hidden md:block">
            <BranchSelector
              clinicId={tenant.clinicId}
              currentBranchId={tenant.branchId}
            />
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-foreground font-inter">Welcome back</h2>
          <p className="text-sm text-muted-foreground font-inter">
            Manage your clinic operations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-card border-border">
            <DropdownMenuItem>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground font-inter">New appointment request</p>
                <p className="text-xs text-muted-foreground font-inter">2 minutes ago</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground font-inter">Lab results ready</p>
                <p className="text-xs text-muted-foreground font-inter">1 hour ago</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground font-inter">Payment received</p>
                <p className="text-xs text-muted-foreground font-inter">3 hours ago</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
            <DropdownMenuItem onClick={handleSignOut} className="text-red-500 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}