"use client";

import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComposeNotificationDialog } from "@/components/notifications/compose-notification-dialog";
import { SentNotifications } from "@/components/notifications/sent-notifications";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import {
  FadeInItem,
  FadeInStagger,
} from "@/components/app-owner/motion-primitives";

/**
 * App-Owner announcements: platform operators compose notifications to tenant
 * owners here. (Receiving bell on this shell is deferred — App Owner is a
 * sender in v1.)
 */
export default function AppOwnerNotificationsPage() {
  const t = useTranslations("notifications");

  return (
    <FadeInStagger className="space-y-6">
      <FadeInItem>
        <AppOwnerPageHeader
          title={t("title")}
          description={t("compose.description")}
          actions={<ComposeNotificationDialog />}
        />
      </FadeInItem>

      <FadeInItem>
        <Card elevated cornerAccent>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <span>{t("center.views.sent")}</span>
            </CardTitle>
            <CardDescription>{t("sent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <SentNotifications />
          </CardContent>
        </Card>
      </FadeInItem>
    </FadeInStagger>
  );
}
