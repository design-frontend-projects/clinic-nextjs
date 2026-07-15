"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Loader2, Pill } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
        <Button size="sm" className="w-full rounded-xl font-semibold bg-accent-blue text-white hover:opacity-95" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Prescription
        </Button>
      </motion.div>

      {prescriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No prescriptions on file.
        </p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {prescriptions.map((rx, idx) => (
              <motion.div
                key={rx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="p-4 rounded-xl border border-border/30 bg-card/35 backdrop-blur-md shadow-sm transition-all hover:bg-card/75 space-y-2.5 text-sm group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">
                    {format(new Date(rx.issued_at), "MMM d, yyyy")}
                  </span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <StatusBadge status={rx.status} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-accent-blue-soft hover:text-accent-blue"
                      onClick={() => openEdit(rx)}
                      aria-label="Edit prescription"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-accent-red hover:bg-accent-red-soft"
                      onClick={() => setDeleteId(rx.id)}
                      aria-label="Delete prescription"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {rx.diagnosis && (
                  <p className="text-xs font-semibold text-muted-foreground">
                    Dx: <span className="font-normal text-foreground">{rx.diagnosis}</span>
                  </p>
                )}
                <ul className="space-y-1.5 pt-1.5 border-t border-border/20">
                  {rx.prescription_items.map((item, i) => (
                    <li key={i} className="text-muted-foreground text-xs flex items-start gap-1.5 leading-relaxed">
                      <Pill className="h-3.5 w-3.5 text-accent-blue shrink-0 mt-0.5" />
                      <span>{describeItem(item)}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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
        <AlertDialogContent className="rounded-2xl border border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Delete this prescription?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. It will remove the patient record permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-medium" disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/95 rounded-xl font-medium"
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
