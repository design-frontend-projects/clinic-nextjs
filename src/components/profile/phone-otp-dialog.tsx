"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, MailCheck, Phone, RefreshCw, ShieldCheck } from "lucide-react";

import {
  cancelPhoneChangeOtp,
  requestPhoneChangeOtp,
  verifyPhoneChangeOtp,
} from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_REGEX = /^\d{6,8}$/;

interface PhoneOtpDialogProps {
  open: boolean;
  newPhone: string;
  maskedEmail: string;
  onVerified: (verifiedPhone: string) => void;
  onCancel: () => void;
}

export function PhoneOtpDialog({
  open,
  newPhone,
  maskedEmail,
  onVerified,
  onCancel,
}: PhoneOtpDialogProps) {
  const t = useTranslations("pages.profile");
  const [otp, setOtp] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!open) {
      setOtp("");
      setInlineError(null);
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, [open, newPhone]);

  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, cooldown]);

  const verifyMutation = useMutation({
    mutationFn: (code: string) =>
      verifyPhoneChangeOtp({ newPhone, otp: code }),
    onSuccess: (result) => {
      if (!result.success) {
        if (result.code === "otp_expired") {
          setInlineError(t("toastOtpExpired"));
        } else if (result.code === "invalid_otp") {
          setInlineError(t("toastOtpInvalid"));
        } else {
          setInlineError(result.error);
        }
        return;
      }
      toast.success(t("toastPhoneUpdated"));
      onVerified(result.phone);
    },
    onError: () => {
      setInlineError(t("toastOtpInvalid"));
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => requestPhoneChangeOtp({ newPhone }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(
          result.code === "rate_limited"
            ? t("toastOtpRateLimited")
            : result.error || t("toastOtpSendFailed"),
        );
        return;
      }
      setInlineError(null);
      setOtp("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(t("toastOtpSent"));
    },
    onError: () => {
      toast.error(t("toastOtpSendFailed"));
    },
  });

  const handleClose = async () => {
    if (verifyMutation.isPending) return;
    try {
      await cancelPhoneChangeOtp();
    } catch {
      // Best-effort cleanup of the pending cookie.
    }
    onCancel();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = otp.replace(/\s+/g, "");
    if (!OTP_REGEX.test(cleaned)) {
      setInlineError(t("errOtpFormat"));
      return;
    }
    setInlineError(null);
    verifyMutation.mutate(cleaned);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle>{t("otpDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("otpDialogDescription", {
              email: maskedEmail,
              phone: newPhone,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 rounded-[var(--radius-input)] border border-hairline bg-canvas-soft px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {t("otpPendingPhoneLabel")}
          </span>
          <span className="font-mono font-semibold text-foreground" dir="ltr">
            {newPhone}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-otp-code" className="flex items-center gap-2">
              <MailCheck className="h-4 w-4 text-muted-foreground" />
              {t("otpCodeLabel")}
            </Label>
            <Input
              id="phone-otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              dir="ltr"
              placeholder={t("otpCodePlaceholder")}
              value={otp}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                setOtp(digitsOnly);
                if (inlineError) setInlineError(null);
              }}
              className="text-center font-mono text-lg tracking-[0.35em]"
              disabled={verifyMutation.isPending}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t("otpCodeHint")}</p>
            {inlineError && (
              <p className="text-xs font-medium text-destructive">
                {inlineError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              disabled={
                cooldown > 0 ||
                resendMutation.isPending ||
                verifyMutation.isPending
              }
              onClick={() => resendMutation.mutate()}
            >
              {resendMutation.isPending ? (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="me-1.5 h-3.5 w-3.5" />
              )}
              {cooldown > 0
                ? t("btnResendCountdown", { seconds: cooldown })
                : t("btnResendCode")}
            </Button>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleClose()}
              disabled={verifyMutation.isPending}
            >
              {t("btnCancel")}
            </Button>
            <Button
              type="submit"
              disabled={verifyMutation.isPending || otp.length < 6}
            >
              {verifyMutation.isPending && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {verifyMutation.isPending
                ? t("btnVerifying")
                : t("btnVerifyPhone")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
