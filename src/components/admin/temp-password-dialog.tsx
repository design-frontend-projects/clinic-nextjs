"use client";

import { useRef, useState } from "react";
import { Check, Copy, KeyRound, MessageCircle } from "lucide-react";
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
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import {
  buildTempPasswordShareMessage,
  buildWhatsAppShareUrl,
  parseWhatsAppPhone,
} from "@/lib/whatsapp/share-link";

export interface TempPasswordInfo {
  tempPassword: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface TempPasswordDialogProps {
  info: TempPasswordInfo | null;
  onClose: () => void;
}

/**
 * Shows the temporary password generated for a newly created account. Because
 * accounts are now created with `admin.createUser` (no invite email), this is
 * the only place the credential is surfaced — the admin must share it securely.
 */
export function TempPasswordDialog({ info, onClose }: TempPasswordDialogProps) {
  const t = useTranslations("admin.tempPassword");
  const locale = useLocale();
  const [prevInfo, setPrevInfo] = useState<TempPasswordInfo | null>(info);
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState(info?.phone ?? "");
  const phoneInputRef = useRef<HTMLInputElement>(null);

  if (info !== prevInfo) {
    setPrevInfo(info);
    setPhone(info?.phone ?? "");
    setCopied(false);
  }

  const phoneStatus = parseWhatsAppPhone(phone);

  const handleCopy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.tempPassword);
      setCopied(true);
      toast.success(t("toastCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("toastCopyFailed"));
    }
  };

  const handleShareWhatsApp = () => {
    if (!info) return;

    const signInUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/${locale}/sign-in`
        : "";

    const greeting = info.fullName?.trim()
      ? t("whatsappMessage.greetingWithName", { name: info.fullName.trim() })
      : t("whatsappMessage.greetingGeneric");

    const text = buildTempPasswordShareMessage({
      greeting,
      intro: t("whatsappMessage.intro"),
      emailLabel: t("whatsappMessage.emailLabel"),
      email: info.email,
      passwordLabel: t("whatsappMessage.passwordLabel"),
      tempPassword: info.tempPassword,
      signInUrlLabel: t("whatsappMessage.signInUrlLabel"),
      signInUrl,
      changePasswordNote: t("whatsappMessage.changePasswordNote"),
    });

    const result = buildWhatsAppShareUrl({ phone, text });

    if ("error" in result) {
      toast.error(
        result.error === "missing_country_code"
          ? t("whatsappPhoneMissingCountryCode")
          : t("whatsappPhoneInvalid"),
      );
      phoneInputRef.current?.focus();
      return;
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
    toast.success(t("toastWhatsAppOpened"));
  };

  return (
    <Dialog
      open={!!info}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-[460px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {info?.fullName
              ? t("descWithName", { name: info.fullName })
              : t("descGeneric")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
          <code className="flex-1 select-all break-all font-mono text-sm">
            {info?.tempPassword}
          </code>
          <Button type="button" size="icon" variant="ghost" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {info?.email && (
          <p className="text-xs text-muted-foreground">
            {t("signInEmail")}{" "}
            <span className="font-medium">{info.email}</span>
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="temp-password-whatsapp-phone">
            {t("whatsappPhoneLabel")}
          </Label>
          <Input
            ref={phoneInputRef}
            id="temp-password-whatsapp-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("whatsappPhonePlaceholder")}
          />
          {phoneStatus.status === "missing_country_code" ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t("whatsappPhoneMissingCountryCode")}
            </p>
          ) : phoneStatus.status === "invalid" ? (
            <p className="text-xs text-destructive">
              {t("whatsappPhoneInvalid")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("whatsappPhoneHint")}
            </p>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleShareWhatsApp}
          >
            <MessageCircle className="me-2 h-4 w-4 text-emerald-600" />
            {t("shareWhatsApp")}
          </Button>
          <Button type="button" onClick={onClose}>
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
