"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PrescriptionDialog } from "@/components/prescriptions/prescription-dialog";
import type { PrescriptionRecord } from "@/components/prescriptions/prescription-form";
import { deletePrescription } from "@/app/actions/prescription";

interface PatientPrescriptionItem {
  medication_id: string | null;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity: number | null;
  instructions: string | null;
}

export interface PatientPrescription {
  id: string;
  patient_id: string;
  diagnosis: string | null;
  notes: string | null;
  status: string;
  issued_at: string | Date;
  prescription_items: PatientPrescriptionItem[];
}

interface PatientPrescriptionsProps {
  patientId: string;
  prescriptions: PatientPrescription[];
}

function describeItem(item: PatientPrescriptionItem): string {
  return [item.medication_name, item.dosage, item.frequency]
    .filter(Boolean)
    .join(" · ");
}

export function PatientPrescriptions({
  patientId,
  prescriptions,
}: PatientPrescriptionsProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PrescriptionRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(rx: PatientPrescription) {
    setEditing({
      id: rx.id,
      patient_id: rx.patient_id,
      diagnosis: rx.diagnosis,
      notes: rx.notes,
      status: rx.status,
      prescription_items: rx.prescription_items,
    });
    setDialogOpen(true);
  }

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deletePrescription(deleteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Prescription deleted");
      setDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Button size="sm" className="w-full" onClick={openNew}>
        <Plus className="mr-2 h-4 w-4" />
        New Prescription
      </Button>

      {prescriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No prescriptions on file.
        </p>
      ) : (
        prescriptions.map((rx) => (
          <div
            key={rx.id}
            className="space-y-2 border-b pb-3 text-sm last:border-0 last:pb-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {format(new Date(rx.issued_at), "MMM d, yyyy")}
              </span>
              <div className="flex items-center gap-1">
                <StatusBadge status={rx.status} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEdit(rx)}
                  aria-label="Edit prescription"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteId(rx.id)}
                  aria-label="Delete prescription"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {rx.diagnosis && (
              <p className="text-muted-foreground">Dx: {rx.diagnosis}</p>
            )}
            <ul className="space-y-1">
              {rx.prescription_items.map((item, i) => (
                <li key={i} className="text-muted-foreground">
                  • {describeItem(item)}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <PrescriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientId={patientId}
        prescription={editing}
        onSaved={() => router.refresh()}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this prescription?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
