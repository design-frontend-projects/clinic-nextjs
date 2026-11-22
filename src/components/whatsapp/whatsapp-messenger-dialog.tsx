"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Send } from "lucide-react";
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
import {
  getWhatsAppRecipientCandidates,
  getWhatsAppTemplates,
  sendWhatsAppMessage,
} from "@/app/actions/whatsapp";
import {
  sendWhatsAppSchema,
  type SendWhatsAppData,
  type WhatsAppAudience,
  type WhatsAppTargetRole,
} from "@/types/whatsapp.types";
import { useTranslations } from "next-intl";

/** Query key for invalidating the sent-history list after a send. */
export const WHATSAPP_KEYS = { all: ["whatsapp-messages"] as const };

/** Which recipient groups a given sender role may target. */
export function allowedWhatsAppTargets(role?: string): WhatsAppTargetRole[] {
  switch (role) {
    case "owner":
    case "admin":
    case "super_admin":
      return ["patient", "doctor", "staff", "pharmacist", "app_owner"];
    case "doctor":
      return ["patient", "staff", "pharmacist"];
    case "staff":
    case "receptionist":
    case "pharmacist":
      return ["patient"];
    case "app_owner":
      return ["app_owner"];
    default:
      return [];
  }
}

interface WhatsAppMessengerDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Reusable WhatsApp composer — usable from every role's Messages screen. */
export function WhatsAppMessengerDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
}: WhatsAppMessengerDialogProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("whatsapp.dialog");
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const roles = useMemo(() => allowedWhatsAppTargets(tenant?.role), [tenant?.role]);

  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [audience, setAudience] = useState<WhatsAppAudience>("role_group");
  const [targetRole, setTargetRole] = useState<WhatsAppTargetRole | "">("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: () => getWhatsAppTemplates(),
    enabled: open,
  });

  const { data: candidates = [], isFetching: loadingCandidates } = useQuery({
    queryKey: ["whatsapp-recipients", targetRole, search],
    queryFn: () => getWhatsAppRecipientCandidates(targetRole as WhatsAppTargetRole, search),
    enabled: open && audience === "individual" && !!targetRole,
  });

  const reset = () => {
    setBody("");
    setTemplateId("");
    setAudience("role_group");
    setTargetRole("");
    setSelectedIds([]);
    setSearch("");
  };

  // Selecting a template fills the body preview (server re-renders per recipient).
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setBody(t.body_en);
  };

  const send = useMutation({
    mutationFn: (data: SendWhatsAppData) => sendWhatsAppMessage(data),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const parts = [t("summarySent", { count: result.sent })];
      if (result.failed) parts.push(t("summaryFailed", { count: result.failed }));
      if (result.skipped) parts.push(t("summarySkipped", { count: result.skipped }));
      toast.success(t("toastSummary", { summary: parts.join(", ") }));
      queryClient.invalidateQueries({ queryKey: WHATSAPP_KEYS.all });
      reset();
      setOpen(false);
    },
    onError: () => toast.error(t("toastFailed")),
  });

  const handleSubmit = () => {
    const isPatientPicker = audience === "individual" && targetRole === "patient";
    const payload: SendWhatsAppData = {
      body: body || undefined,
      templateId: templateId || undefined,
      audience,
      targetRole: audience === "role_group" ? (targetRole || undefined) : undefined,
      targetProfileIds:
        audience === "individual" && !isPatientPicker ? selectedIds : undefined,
      targetPatientIds:
        audience === "individual" && isPatientPicker ? selectedIds : undefined,
    };
    const parsed = sendWhatsAppSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || t("toastInvalidMessage"));
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
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              {t("newButton")}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("templateLabel")}</Label>
              <Select value={templateId || undefined} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={t("templatePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="wa-body">{t("messageLabel")}</Label>
            <Textarea
              id="wa-body"
              value={body}
              maxLength={4096}
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("messagePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("recipientsLabel")}</Label>
            <RadioGroup
              value={audience}
              onValueChange={(v) => {
                setAudience(v as WhatsAppAudience);
                setSelectedIds([]);
              }}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="role_group" id="wa-aud-group" />
                <Label htmlFor="wa-aud-group" className="font-normal">
                  {t("byGroup")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="individual" id="wa-aud-individual" />
                <Label htmlFor="wa-aud-individual" className="font-normal">
                  {t("pickIndividuals")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>{t("recipientGroupLabel")}</Label>
            <Select
              value={targetRole || undefined}
              onValueChange={(v) => {
                setTargetRole(v as WhatsAppTargetRole);
                setSelectedIds([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("recipientGroupPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roleLabels.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {audience === "individual" && targetRole && (
            <div className="space-y-1.5">
              <Label>{t("selectRecipientsLabel")}</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
              />
              <ScrollArea className="h-40 rounded-md border border-border">
                <div className="flex flex-col gap-1 p-2">
                  {loadingCandidates ? (
                    <div className="flex justify-center py-6 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : candidates.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {t("noRecipients")}
                    </p>
                  ) : (
                    candidates.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/60"
                      >
                        <Checkbox
                          checked={selectedIds.includes(c.id)}
                          disabled={!c.has_phone}
                          onCheckedChange={(v) => toggleRecipient(c.id, v === true)}
                        />
                        <span className="text-sm">{c.full_name || c.id.slice(0, 8)}</span>
                        {!c.has_phone && (
                          <span className="text-xs text-muted-foreground">{t("noNumber")}</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              {selectedIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("selectedCount", { count: selectedIds.length })}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => (setOpen(false), reset())}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={send.isPending} className="gap-2">
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
