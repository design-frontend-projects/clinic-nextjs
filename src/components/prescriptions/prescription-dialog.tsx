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

interface PrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, prescribes for this patient and hides the patient picker. */
  patientId?: string;
  /** When set, the dialog edits this prescription. */
  prescription?: PrescriptionRecord | null;
  /** Called after a successful create/update (parent refetches). */
  onSaved: () => void;
}

export function PrescriptionDialog({
  open,
  onOpenChange,
  patientId,
  prescription,
  onSaved,
}: PrescriptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {prescription ? "Edit Prescription" : "New Prescription"}
          </DialogTitle>
          <DialogDescription>
            {prescription
              ? "Update the diagnosis, status, and prescribed medications."
              : "Record a diagnosis and one or more prescribed medications."}
          </DialogDescription>
        </DialogHeader>

        <PrescriptionForm
          patientId={patientId}
          prescription={prescription}
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
