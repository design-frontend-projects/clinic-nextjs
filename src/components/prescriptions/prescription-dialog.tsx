"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PrescriptionForm,
  type PrescriptionRecord,
} from "./prescription-form";
import { useTranslations } from "next-intl";

interface PrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, prescribes for this patient and hides the patient picker. */
  patientId?: string;
  /** When set, the dialog edits or views this prescription. */
  prescription?: PrescriptionRecord | null;
  /** Dialog mode: create, edit, or read-only view. */
  mode?: "create" | "edit" | "view";
  /** Called after a successful create/update (parent refetches). */
  onSaved: () => void;
}

export function PrescriptionDialog({
  open,
  onOpenChange,
  patientId,
  prescription,
  mode,
  onSaved,
}: PrescriptionDialogProps) {
  const t = useTranslations("prescriptions.dialog");
  const resolvedMode = mode ?? (prescription ? "edit" : "create");
  const isView = resolvedMode === "view";

  const title = isView
    ? t("viewTitle")
    : prescription
      ? t("editTitle")
      : t("newTitle");
  const description = isView
    ? t("viewDescription")
    : prescription
      ? t("editDescription")
      : t("newDescription");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <PrescriptionForm
          key={`${resolvedMode}-${prescription?.id ?? "new"}`}
          patientId={patientId}
          prescription={prescription}
          readOnly={isView}
          onCancel={() => onOpenChange(false)}
          onSuccess={() => {
            onSaved();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
