"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getNotificationChannels, getNotificationTemplates } from "../actions";
import { CHANNEL_TYPES } from "../domain/models";
import { useModuleSettings, useSaveSettings, valuesByKey } from "../hooks/use-settings";
import { TabError, TabLoading } from "./tab-states";
import { TemplateEditor, type TemplateRow } from "./TemplateEditor";
import { ChannelConfigForm, type ChannelRow } from "./ChannelConfigForm";

function GeneralNotificationSettings() {
  const t = useTranslations("settings");
  const { data, isLoading, error, refetch } = useModuleSettings("notifications");
  const save = useSaveSettings();
  const values = valuesByKey(data);
  const [senderName, setSenderName] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean | null>(null);

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={error.message} onRetry={() => refetch()} />;

  const currentSender = senderName ?? ((values["notifications.sender_name"] as string) || "");
  const currentReminders = remindersEnabled ?? ((values["notifications.reminders_enabled"] as boolean) ?? true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notificationsTab.title")}</CardTitle>
        <CardDescription>{t("notificationsTab.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sender_name">{t("notificationsTab.senderName")}</Label>
            <Input id="sender_name" value={currentSender} onChange={(event) => setSenderName(event.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={currentReminders} onCheckedChange={(checked) => setRemindersEnabled(checked === true)} />
            <Label>{t("notificationsTab.remindersEnabled")}</Label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate([
                { key: "notifications.sender_name", value: currentSender },
                { key: "notifications.reminders_enabled", value: currentReminders },
              ])
            }
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesSection() {
  const t = useTranslations("settings.notificationsTab");
  const tCommon = useTranslations("settings");
  const [editing, setEditing] = useState<TemplateRow | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: async (): Promise<TemplateRow[]> => {
      const result = await getNotificationTemplates({});
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as TemplateRow[];
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={(error as Error).message} onRetry={() => refetch()} />;

  // A tenant override hides its matching global row in the list.
  const templates = (data ?? []).filter(
    (row) =>
      row.tenant_id !== null ||
      !(data ?? []).some(
        (other) =>
          other.tenant_id !== null &&
          other.channel === row.channel &&
          other.template_key === row.template_key &&
          other.locale === row.locale
      )
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("templates")}</CardTitle>
        <CardDescription>{t("templatesDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("key")}</TableHead>
                <TableHead>{t("channelType")}</TableHead>
                <TableHead>{t("locale")}</TableHead>
                <TableHead>{t("source")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.template_key}</TableCell>
                  <TableCell>{tCommon(`channels.${row.channel}`)}</TableCell>
                  <TableCell className="uppercase">{row.locale}</TableCell>
                  <TableCell>
                    <Badge variant={row.tenant_id ? "default" : "outline"}>
                      {row.tenant_id ? t("custom") : t("global")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                      {tCommon("common.edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {editing && <TemplateEditor key={editing.id} template={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function ChannelsSection() {
  const t = useTranslations("settings.notificationsTab");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notification-channels"],
    queryFn: async (): Promise<ChannelRow[]> => {
      const result = await getNotificationChannels();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as ChannelRow[];
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{t("channelsSection")}</h3>
        <p className="text-sm text-muted-foreground">{t("channelsDescription")}</p>
      </div>
      {CHANNEL_TYPES.map((channelType) => (
        <ChannelConfigForm
          key={`${channelType}-${data?.find((c) => c.channel_type === channelType)?.id ?? "new"}`}
          channelType={channelType}
          existing={data?.find((channel) => channel.channel_type === channelType)}
        />
      ))}
    </div>
  );
}

export function NotificationsTab() {
  return (
    <div className="space-y-6">
      <GeneralNotificationSettings />
      <TemplatesSection />
      <ChannelsSection />
    </div>
  );
}
