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
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";

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

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    useAuthStore.getState().setSession(null);
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-4">
      <Link href={dashboardPath}>
        <Button variant="secondary" className="text-sm">
          Dashboard
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
              <p className="font-medium">{fullName || "User"}</p>
              {email && (
                <p className="w-[200px] truncate text-sm text-muted-foreground">
                  {email}
                </p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={dashboardPath}>Dashboard</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
