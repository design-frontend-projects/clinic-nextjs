"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMedicineLabel,
  type ClinicMedicineRecord,
} from "@/types/medication.types";
import { stopClinicMedicine } from "@/app/actions/medicine";

interface StopMedicineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicine: ClinicMedicineRecord | null;
  onStopped: () => void;
}

export function StopMedicineDialog({
  open,
  onOpenChange,
  medicine,
  onStopped,
}: StopMedicineDialogProps) {
  const t = useTranslations("medicines.stopDialog");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open, medicine?.id]);

  function handleStop() {
    if (!medicine) return;
    startTransition(async () => {
      const result = await stopClinicMedicine({
        id: medicine.id,
        stop_reason: reason.trim() || null,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(t("toastStopped"));
      onStopped();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {medicine
              ? t("description", { name: formatMedicineLabel(medicine) })
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="stop-medicine-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="stop-medicine-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            maxLength={500}
            className="min-h-[80px]"
            disabled={isPending}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleStop}
            disabled={isPending || !medicine}
          >
            {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
