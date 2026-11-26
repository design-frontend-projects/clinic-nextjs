"use client";

import { useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { invitePatientToPortal } from "@/app/actions/patient";
import type { TempPasswordInfo } from "@/components/admin/temp-password-dialog";
import { Button } from "@/components/ui/button";
import type { PatientRow } from "@/types/patient.types";

export interface InviteToPortalButtonProps {
  patient: PatientRow;
  onInvited: (info: TempPasswordInfo) => void;
  size?: "sm" | "default";
  variant?: "outline" | "default";
  className?: string;
  showActiveLabel?: boolean;
}

/**
 * Shared portal-invitation button. Delegates displaying `TempPasswordDialog`
 * to the parent component so table refetches never unmount the credential modal.
 */
export function InviteToPortalButton({
  patient,
  onInvited,
  size = "sm",
  variant = "outline",
  className,
  showActiveLabel = true,
}: InviteToPortalButtonProps) {
  const t = useTranslations("patients.portal");
  const [isPending, startTransition] = useTransition();

  if (patient.profile_id) {
    if (!showActiveLabel) return null;
    return (
      <span className="text-xs text-muted-foreground">{t("portalActive")}</span>
    );
  }

  const handleInvite = () => {
    if (!patient.email) {
      toast.error(t("noEmail"));
      return;
    }
    startTransition(async () => {
      try {
        const result = await invitePatientToPortal(patient.id);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        if (result?.success && result.tempPassword) {
          onInvited({
            tempPassword: result.tempPassword,
            fullName: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim(),
            email: patient.email,
            phone: patient.phone,
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("inviteFailed"),
        );
      }
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleInvite}
      disabled={isPending || !patient.email}
    >
      {isPending ? (
        <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mail className="me-2 h-3.5 w-3.5" />
      )}
      {t("invite")}
    </Button>
  );
}
