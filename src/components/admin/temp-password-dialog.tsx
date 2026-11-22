"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export interface TempPasswordInfo {
  tempPassword: string;
  fullName?: string | null;
  email?: string | null;
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
  const [copied, setCopied] = useState(false);

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
      <DialogContent className="sm:max-w-[440px]">
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

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
