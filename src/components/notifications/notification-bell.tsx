"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { getUnreadCount } from "@/app/actions/notifications";
import {
  NOTIFICATION_KEYS,
  useNotificationsRealtime,
} from "@/lib/notifications/use-notifications-realtime";
import { NotificationPanel } from "./notification-panel";

/** Header notification bell: live unread badge + dropdown panel. */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  useNotificationsRealtime(tenant?.profileId);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: NOTIFICATION_KEYS.unreadCount,
    queryFn: () => getUnreadCount(),
    enabled: !!tenant?.profileId,
  });

  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="relative h-9 w-9"
          aria-label={t("title")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -inset-e-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full p-0 px-1 text-[10px]"
            >
              {badge}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        <NotificationPanel onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
