"use client";

import { LogOut, User } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { performClientSignOut } from "@/lib/client-sign-out";
import { useTranslations } from "next-intl";

interface LandingUserNavProps {
  fullName?: string | null;
  email?: string | null;
  dashboardPath: string;
}

export function LandingUserNav({
  fullName,
  email,
  dashboardPath,
}: LandingUserNavProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("layout.landingUserNav");

  const handleSignOut = async () => {
    await performClientSignOut(queryClient);
    router.replace("/sign-in");
  };

  return (
    <div className="flex items-center gap-4">
      <Link href={dashboardPath}>
        <Button variant="secondary" className="text-sm">
          {t("dashboard")}
        </Button>
      </Link>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full overflow-hidden">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-transparent">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium">{fullName || t("userFallback")}</p>
              {email && (
                <p className="w-[200px] truncate text-sm text-muted-foreground">
                  {email}
                </p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/profile">{t("profile")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={dashboardPath}>{t("dashboard")}</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
            <LogOut className="me-2 h-4 w-4" />
            <span>{t("logout")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
