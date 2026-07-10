"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { testNotificationChannel, upsertNotificationChannel } from "../actions";
import type { ChannelType } from "../domain/models";

export interface ChannelRow {
  id: string;
  channel_type: string;
  config: Record<string, unknown>;
  hasSecret: boolean;
  is_enabled: boolean;
  is_verified: boolean;
}

interface ChannelConfigFormProps {
  channelType: ChannelType;
  existing: ChannelRow | undefined;
}

const FIELDS_BY_TYPE: Record<ChannelType, { key: string; labelKey: string; type?: string }[]> = {
  smtp: [
    { key: "host", labelKey: "host" },
    { key: "port", labelKey: "port", type: "number" },
    { key: "username", labelKey: "username" },
    { key: "from_address", labelKey: "fromAddress" },
  ],
  twilio_sms: [
    { key: "username", labelKey: "username" },
    { key: "from_address", labelKey: "fromAddress" },
  ],
  whatsapp: [
    { key: "username", labelKey: "username" },
    { key: "from_address", labelKey: "fromAddress" },
  ],
  webhook: [{ key: "host", labelKey: "host" }],
};

export function ChannelConfigForm({ channelType, existing }: ChannelConfigFormProps) {
  const t = useTranslations("settings.notificationsTab");
  const tCommon = useTranslations("settings");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [config, setConfig] = useState<Record<string, unknown>>(existing?.config ?? {});
  const [secret, setSecret] = useState("");
  const [isEnabled, setIsEnabled] = useState(existing?.is_enabled ?? false);

  const fields = FIELDS_BY_TYPE[channelType];

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertNotificationChannel({
        channel_type: channelType,
        config,
        secret: secret || undefined,
        is_enabled: isEnabled,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(tCommon("saved"));
      setSecret("");
      queryClient.invalidateQueries({ queryKey: ["notification-channels"] });
    });
  };

  const handleTest = () => {
    startTransition(async () => {
      const result = await testNotificationChannel({ channel_type: channelType });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("testSuccess"));
      }
      queryClient.invalidateQueries({ queryKey: ["notification-channels"] });
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{channelType.replace(/_/g, " ").toUpperCase()}</CardTitle>
        <div className="flex items-center gap-2">
          {existing &&
            (existing.is_verified ? (
              <Badge variant="secondary">{t("verified")}</Badge>
            ) : (
              <Badge variant="outline">{t("notVerified")}</Badge>
            ))}
          <Switch checked={isEnabled} onCheckedChange={(checked) => setIsEnabled(checked === true)} />
          <span className="text-xs text-muted-foreground">{t("enabled")}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`${channelType}-${field.key}`}>{t(field.labelKey)}</Label>
              <Input
                id={`${channelType}-${field.key}`}
                type={field.type ?? "text"}
                value={String(config[field.key] ?? "")}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor={`${channelType}-secret`}>{t("secret")}</Label>
            <Input
              id={`${channelType}-secret`}
              type="password"
              autoComplete="new-password"
              placeholder={existing?.hasSecret ? "••••••••" : ""}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {existing?.hasSecret ? t("secretStored") : t("secretHint")}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending || !existing?.hasSecret}
          >
            {t("test")}
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
