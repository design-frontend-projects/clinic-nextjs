"use client";

import { useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default function NotificationsCenterPage() {
  const t = useTranslations("notifications");

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <Heading title={t("center.title")} description={t("center.description")} />
      <Separator />
      <NotificationCenter />
    </div>
  );
}
