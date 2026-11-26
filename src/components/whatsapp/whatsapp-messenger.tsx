"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSentWhatsAppMessages } from "@/app/actions/whatsapp";
import {
  WhatsAppMessengerDialog,
  WHATSAPP_KEYS,
} from "@/components/whatsapp/whatsapp-messenger-dialog";
import { cn } from "@/lib/utils";

/**
 * Full-page WhatsApp messaging screen. Reused verbatim by every role's
 * `/…/messages` route — the composer itself decides which recipient groups the
 * signed-in role may target.
 */
export function WhatsAppMessenger() {
  const locale = useLocale();
  const t = useTranslations("whatsapp");
  const { data } = useQuery({
    queryKey: WHATSAPP_KEYS.all,
    queryFn: () => getSentWhatsAppMessages({ page: 1, pageSize: 20 }),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading title={t("title")} description={t("description")} />
        <div className="shrink-0">
          <WhatsAppMessengerDialog />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-eyebrow uppercase tracking-wider text-muted-foreground">
          {t("recentMessages")}
        </h3>

        {items.length === 0 ? (
          <Card elevated className="p-10 text-center">
            <MessageCircle className="mx-auto mb-2.5 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {items.map((m) => {
              const isSent = m.status === "sent";
              return (
                <Card key={m.id} elevated className="py-0">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <p className="break-words text-sm text-foreground">
                        {m.body}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span dir="ltr" className="font-mono">
                          {m.to_phone}
                        </span>
                        {m.recipient_role && <span>· {m.recipient_role}</span>}
                        <span>
                          · {new Date(m.created_at).toLocaleString(locale)}
                        </span>
                      </p>
                      {m.status === "failed" && m.error && (
                        <p className="text-xs text-destructive">{m.error}</p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "w-fit shrink-0 border-0 font-medium",
                        isSent
                          ? "bg-accent-green-soft text-accent-green"
                          : "bg-accent-red-soft text-accent-red",
                      )}
                    >
                      {isSent ? t("statusSent") : t("statusFailed")}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
