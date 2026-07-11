"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { useRouter } from "@/i18n/routing";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { NOTIFICATION_KEYS } from "@/lib/notifications/use-notifications-realtime";
import type { MyNotification, NotificationFilter } from "@/types/notification.types";
import { ComposeNotificationDialog } from "./compose-notification-dialog";

const TABS: NotificationFilter[] = ["all", "unread", "read"];
const CENTER_PAGE_SIZE = 100;

/** Full-page notification history: filter tabs, table, compose, mark-all-read. */
export function NotificationCenter() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<NotificationFilter>("all");

  const { data } = useQuery({
    queryKey: [...NOTIFICATION_KEYS.all, "center", tab],
    queryFn: () => getMyNotifications({ status: tab, page: 1, pageSize: CENTER_PAGE_SIZE }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all }),
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all }),
  });

  const open = (n: MyNotification) => {
    if (n.status === "unread") markRead.mutate(n.id);
    if (n.deep_link) router.push(n.deep_link);
  };

  const columns = useMemo<ColumnDef<MyNotification>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("center.columns.title"),
        cell: ({ row }) => {
          const n = row.original;
          return (
            <div className="flex max-w-md flex-col">
              <span className={n.status === "unread" ? "font-semibold" : ""}>{n.title}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{n.body}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "sender_name",
        header: t("center.columns.sender"),
        cell: ({ row }) =>
          row.original.sender_name || t(`roles.${row.original.sender_role}`),
      },
      {
        accessorKey: "priority",
        header: t("center.columns.priority"),
        cell: ({ row }) =>
          row.original.priority === "important" ? (
            <Badge variant="destructive">{t("priority.important")}</Badge>
          ) : (
            <span className="text-muted-foreground">{t("priority.normal")}</span>
          ),
      },
      {
        accessorKey: "status",
        header: t("center.columns.status"),
        cell: ({ row }) => (
          <Badge variant={row.original.status === "unread" ? "default" : "secondary"}>
            {t(`tabs.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: t("center.columns.received"),
        cell: ({ row }) =>
          formatDistanceToNow(new Date(row.original.created_at), {
            addSuffix: true,
            locale: locale === "ar" ? arLocale : undefined,
          }),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => open(row.original)}>
            {t("center.open")}
            {row.original.deep_link && <ExternalLink className="h-3.5 w-3.5" />}
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale],
  );

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as NotificationFilter)}>
          <TabsList>
            {TABS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`tabs.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => markAll.mutate()}>
            <CheckCheck className="h-4 w-4" />
            {t("markAllRead")}
          </Button>
          <ComposeNotificationDialog />
        </div>
      </div>

      <DataTable columns={columns} data={items} />
    </div>
  );
}
