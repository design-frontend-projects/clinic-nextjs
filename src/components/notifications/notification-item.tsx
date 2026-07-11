"use client";

import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MyNotification } from "@/types/notification.types";

interface NotificationItemProps {
  notification: MyNotification;
  onOpen: (notification: MyNotification) => void;
}

/** A single inbox row: unread is bold/accented, read is dimmed. */
export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const isUnread = notification.status === "unread";

  const relative = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: locale === "ar" ? arLocale : undefined,
  });

  const sender = notification.sender_name || t(`roles.${notification.sender_role}`);

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-3 text-start transition-colors hover:bg-accent/60",
        isUnread ? "bg-accent/30" : "opacity-70",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          isUnread
            ? notification.priority === "important"
              ? "bg-destructive"
              : "bg-primary"
            : "bg-transparent",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm text-foreground",
              isUnread && "font-semibold",
            )}
          >
            {notification.title}
          </p>
          {notification.priority === "important" && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              {t("priority.important")}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{sender}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{relative}</span>
        </div>
      </div>
    </button>
  );
}
