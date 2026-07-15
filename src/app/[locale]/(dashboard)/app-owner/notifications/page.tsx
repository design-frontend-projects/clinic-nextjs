"use client";

import { useTranslations } from "next-intl";
import { Bell, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposeNotificationDialog } from "@/components/notifications/compose-notification-dialog";
import { SentNotifications } from "@/components/notifications/sent-notifications";

/**
 * App-Owner announcements: platform operators compose notifications to tenant
 * owners here. (Receiving bell on this shell is deferred — App Owner is a
 * sender in v1.)
 */
export default function AppOwnerNotificationsPage() {
  const t = useTranslations("notifications");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("compose.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t("compose.title")}
          </CardTitle>
          <CardDescription>{t("compose.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ComposeNotificationDialog />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t("center.views.sent")}
          </CardTitle>
          <CardDescription>{t("sent.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SentNotifications />
        </CardContent>
      </Card>
    </div>
  );
}
