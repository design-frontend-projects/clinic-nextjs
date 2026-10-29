"use client";

import { useQuery } from "@tanstack/react-query";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSentWhatsAppMessages } from "@/app/actions/whatsapp";
import {
  WhatsAppMessengerDialog,
  WHATSAPP_KEYS,
} from "@/components/whatsapp/whatsapp-messenger-dialog";

/**
 * Full-page WhatsApp messaging screen. Reused verbatim by every role's
 * `/…/messages` route — the composer itself decides which recipient groups the
 * signed-in role may target.
 */
export function WhatsAppMessenger() {
  const { data } = useQuery({
    queryKey: WHATSAPP_KEYS.all,
    queryFn: () => getSentWhatsAppMessages({ page: 1, pageSize: 20 }),
  });

  const items = data?.items ?? [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <Heading
          title="WhatsApp Messages"
          description="Send WhatsApp messages to patients, staff, doctors, and the app owner."
        />
        <WhatsAppMessengerDialog />
      </div>
      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Recent messages</h3>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages sent yet.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((m) => (
              <Card key={m.id} className="flex items-start justify-between gap-4 p-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm">{m.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.to_phone}
                    {m.recipient_role ? ` · ${m.recipient_role}` : ""} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                  {m.status === "failed" && m.error && (
                    <p className="text-xs text-destructive">{m.error}</p>
                  )}
                </div>
                <Badge variant={m.status === "sent" ? "default" : "destructive"}>
                  {m.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
