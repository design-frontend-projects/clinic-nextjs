"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/routing";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { NOTIFICATION_KEYS } from "@/lib/notifications/use-notifications-realtime";
import type { MyNotification, NotificationFilter } from "@/types/notification.types";
import { NotificationItem } from "./notification-item";

const TABS: NotificationFilter[] = ["all", "unread", "read"];
const PANEL_PAGE_SIZE = 15;

interface NotificationPanelProps {
  /** Called when the user opens a notification (e.g. to close the popover). */
  onNavigate?: () => void;
}

/** Bell-dropdown content: filter tabs, recent items, mark-all-read. */
export function NotificationPanel({ onNavigate }: NotificationPanelProps) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<NotificationFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: [...NOTIFICATION_KEYS.all, "panel", tab],
    queryFn: () => getMyNotifications({ status: tab, page: 1, pageSize: PANEL_PAGE_SIZE }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all }),
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all }),
  });

  const openNotification = (n: MyNotification) => {
    if (n.status === "unread") markRead.mutate(n.id);
    onNavigate?.();
    if (n.deep_link) router.push(n.deep_link);
  };

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          {t("markAllRead")}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as NotificationFilter)} className="px-3 pt-2">
        <TabsList className="w-full">
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="flex-1 text-xs">
              {t(`tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ScrollArea className="h-80">
        <div className="flex flex-col gap-1 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {t(`empty.${tab}`)}
            </p>
          ) : (
            items.map((n) => (
              <NotificationItem key={n.id} notification={n} onOpen={openNotification} />
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-2">
        <Button asChild variant="ghost" size="sm" className="w-full text-xs">
          <Link href="/settings/notifications" onClick={() => onNavigate?.()}>
            {t("viewAll")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
