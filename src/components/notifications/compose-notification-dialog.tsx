"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { getRecipientCandidates, sendNotification } from "@/app/actions/notifications";
import { NOTIFICATION_KEYS } from "@/lib/notifications/use-notifications-realtime";
import {
  notificationCategoryEnum,
  sendNotificationSchema,
  type Audience,
  type NotificationCategory,
  type NotificationPriority,
  type SendNotificationData,
  type TargetRole,
} from "@/types/notification.types";

/** Which recipient roles a sender may target (mirrors the server guard). */
function allowedTargetRoles(role?: string): TargetRole[] {
  if (role === "app_owner" || role === "super_admin") return ["owner"];
  if (role === "owner" || role === "admin") return ["owner", "doctor", "staff", "pharmacist"];
  if (role === "doctor") return ["doctor", "staff", "pharmacist"];
  return [];
}

const CATEGORIES = notificationCategoryEnum.options;

interface ComposeNotificationDialogProps {
  trigger?: React.ReactNode;
}

/** Sender-only dialog to compose and fan out a notification. */
export function ComposeNotificationDialog({ trigger }: ComposeNotificationDialogProps) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const roles = useMemo(() => allowedTargetRoles(tenant?.role), [tenant?.role]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<NotificationPriority>("normal");
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [deepLink, setDeepLink] = useState("");
  const [audience, setAudience] = useState<Audience>("role_group");
  const [targetRole, setTargetRole] = useState<TargetRole | "">("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const { data: candidates = [], isFetching: loadingCandidates } = useQuery({
    queryKey: ["notification-recipients", search],
    queryFn: () => getRecipientCandidates(search),
    enabled: open && audience === "individual",
  });

  const reset = () => {
    setTitle("");
    setBody("");
    setPriority("normal");
    setCategory("");
    setDeepLink("");
    setAudience("role_group");
    setTargetRole("");
    setSelectedIds([]);
    setSearch("");
  };

  const send = useMutation({
    mutationFn: (data: SendNotificationData) => sendNotification(data),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toast.sent", { count: result.count }));
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
      reset();
      setOpen(false);
    },
    onError: () => toast.error(t("toast.failed")),
  });

  const handleSubmit = () => {
    const payload = {
      title,
      body,
      priority,
      category: category || undefined,
      deep_link: deepLink || undefined,
      audience,
      targetRole: audience === "role_group" ? (targetRole || undefined) : undefined,
      targetProfileIds: audience === "individual" ? selectedIds : undefined,
    };
    const parsed = sendNotificationSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || t("toast.failed"));
      return;
    }
    send.mutate(parsed.data);
  };

  const toggleRecipient = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  if (roles.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : (setOpen(false), reset()))}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Send className="h-4 w-4" />
            {t("center.newNotification")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("compose.title")}</DialogTitle>
          <DialogDescription>{t("compose.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">{t("compose.fields.title")}</Label>
            <Input
              id="notif-title"
              value={title}
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("compose.placeholders.title")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-body">{t("compose.fields.body")}</Label>
            <Textarea
              id="notif-body"
              value={body}
              maxLength={2000}
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("compose.placeholders.body")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("compose.fields.priority")}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as NotificationPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t("priority.normal")}</SelectItem>
                  <SelectItem value="important">{t("priority.important")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("compose.fields.category")}</Label>
              <Select
                value={category || undefined}
                onValueChange={(v) => setCategory(v as NotificationCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("compose.placeholders.category")} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`category.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-link">{t("compose.fields.deepLink")}</Label>
            <Input
              id="notif-link"
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
              placeholder="/admin/billing"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("compose.fields.audience")}</Label>
            <RadioGroup
              value={audience}
              onValueChange={(v) => setAudience(v as Audience)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="role_group" id="aud-group" />
                <Label htmlFor="aud-group" className="font-normal">
                  {t("audience.role_group")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="individual" id="aud-individual" />
                <Label htmlFor="aud-individual" className="font-normal">
                  {t("audience.individual")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {audience === "role_group" ? (
            <div className="space-y-1.5">
              <Label>{t("compose.fields.recipientGroup")}</Label>
              <Select value={targetRole || undefined} onValueChange={(v) => setTargetRole(v as TargetRole)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("compose.placeholders.recipientGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t("compose.fields.recipients")}</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("compose.placeholders.searchRecipients")}
              />
              <ScrollArea className="h-40 rounded-md border border-border">
                <div className="flex flex-col gap-1 p-2">
                  {loadingCandidates ? (
                    <div className="flex justify-center py-6 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : candidates.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {t("compose.noRecipients")}
                    </p>
                  ) : (
                    candidates.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/60"
                      >
                        <Checkbox
                          checked={selectedIds.includes(c.id)}
                          onCheckedChange={(v) => toggleRecipient(c.id, v === true)}
                        />
                        <span className="text-sm">{c.full_name || c.id.slice(0, 8)}</span>
                        <span className="text-xs text-muted-foreground">{t(`roles.${c.role}`)}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              {selectedIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("compose.selectedCount", { count: selectedIds.length })}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => (setOpen(false), reset())}>
            {t("compose.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={send.isPending} className="gap-2">
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("compose.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
