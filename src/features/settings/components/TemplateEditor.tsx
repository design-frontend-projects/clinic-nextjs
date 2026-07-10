"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { previewTemplate, upsertNotificationTemplate } from "../actions";
import type { NotificationChannel } from "../domain/models";

export interface TemplateRow {
  id: string;
  tenant_id: string | null;
  channel: string;
  template_key: string;
  locale: string;
  subject: string | null;
  body: string;
  variables: unknown;
}

interface TemplateEditorProps {
  template: TemplateRow | null;
  onClose: () => void;
}

export function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const t = useTranslations("settings");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [preview, setPreview] = useState<{ subject: string | null; body: string } | null>(null);

  if (!template) return null;
  const variables = Array.isArray(template.variables) ? (template.variables as string[]) : [];

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertNotificationTemplate({
        channel: template.channel as NotificationChannel,
        template_key: template.template_key,
        locale: template.locale as "en" | "ar",
        subject: template.channel === "email" ? subject : null,
        body,
        variables,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      onClose();
    });
  };

  const handlePreview = () => {
    startTransition(async () => {
      // Save first so the preview reflects the edited body, then render with
      // bracketed sample values for every declared variable.
      const saved = await upsertNotificationTemplate({
        channel: template.channel as NotificationChannel,
        template_key: template.template_key,
        locale: template.locale as "en" | "ar",
        subject: template.channel === "email" ? subject : null,
        body,
        variables,
      });
      if (saved && "error" in saved && saved.error) {
        toast.error(saved.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      const sampleData = Object.fromEntries(variables.map((name) => [name, `[${name}]`]));
      const result = await previewTemplate({
        channel: template.channel as NotificationChannel,
        template_key: template.template_key,
        locale: template.locale as "en" | "ar",
        sampleData,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) setPreview({ subject: result.data.subject, body: result.data.body });
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template.template_key} · {t(`channels.${template.channel}`)} · {template.locale.toUpperCase()}
          </DialogTitle>
          <DialogDescription>{t("notificationsTab.templatesDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {template.channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="template-subject">{t("notificationsTab.subject")}</Label>
              <Input id="template-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="template-body">{t("notificationsTab.body")}</Label>
            <Textarea
              id="template-body"
              rows={6}
              dir="auto"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          {variables.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("notificationsTab.variables")}</p>
              <div className="flex flex-wrap gap-1">
                {variables.map((name) => (
                  <Badge key={name} variant="secondary" className="font-mono text-xs">
                    {`{{${name}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {preview && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm" dir="auto">
              {preview.subject && <p className="mb-1 font-medium">{preview.subject}</p>}
              <p className="whitespace-pre-wrap">{preview.body}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handlePreview} disabled={isPending}>
            {t("notificationsTab.preview")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending || body.trim().length === 0}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
