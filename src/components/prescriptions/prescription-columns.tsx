"use client";

import { useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Pill, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { deletePrescription } from "@/app/actions/prescription";
import type { PrescriptionRecord } from "./prescription-form";

export interface PrescriptionListItem {
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity: number | null;
  instructions: string | null;
  medication_id: string | null;
}

export interface PrescriptionRow {
  id: string;
  patient_id: string;
  patient_name: string;
  diagnosis: string | null;
  notes: string | null;
  status: string;
  issued_at: string | Date;
  prescription_items: PrescriptionListItem[];
}

/** Convert a list row back into the shape the edit form expects. */
export function toPrescriptionRecord(row: PrescriptionRow): PrescriptionRecord {
  return {
    id: row.id,
    patient_id: row.patient_id,
    diagnosis: row.diagnosis,
    notes: row.notes,
    status: row.status,
    prescription_items: row.prescription_items.map((item) => ({
      medication_id: item.medication_id,
      medication_name: item.medication_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route,
      quantity: item.quantity,
      instructions: item.instructions,
    })),
  };
}

interface RowActionsProps {
  row: PrescriptionRow;
  onEdit: (row: PrescriptionRow) => void;
  onDeleted: () => void;
}

function PrescriptionRowActions({ row, onEdit, onDeleted }: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePrescription(row.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Prescription deleted");
      setConfirmOpen(false);
      onDeleted();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Row actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this prescription?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the prescription for {row.patient_name}. This action
              cannot be undone.
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
    </>
  );
}

/** Summarize a prescription's drugs for the table's primary column. */
function medicationSummary(items: PrescriptionListItem[]): {
  primary: string;
  extra: number;
  dosage: string | null;
} {
  if (items.length === 0) {
    return { primary: "No medications", extra: 0, dosage: null };
  }
  const [first, ...rest] = items;
  return { primary: first.medication_name, extra: rest.length, dosage: first.dosage };
}

interface ColumnHandlers {
  onEdit: (row: PrescriptionRow) => void;
  onDeleted: () => void;
}

export function createPrescriptionColumns({
  onEdit,
  onDeleted,
}: ColumnHandlers): ColumnDef<PrescriptionRow>[] {
  return [
    {
      accessorKey: "medications",
      header: "Medications",
      cell: ({ row }) => {
        const { primary, extra, dosage } = medicationSummary(
          row.original.prescription_items,
        );
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/30">
              <Pill className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="font-medium">
                {primary}
                {extra > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    +{extra} more
                  </span>
                )}
              </p>
              {dosage && (
                <p className="text-xs text-muted-foreground">{dosage}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "patient_name",
      header: "Patient",
    },
    {
      accessorKey: "diagnosis",
      header: "Diagnosis",
      cell: ({ row }) => row.original.diagnosis || "—",
    },
    {
      accessorKey: "issued_at",
      header: "Date Issued",
      cell: ({ row }) => format(new Date(row.original.issued_at), "MMM d, yyyy"),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <PrescriptionRowActions
          row={row.original}
          onEdit={onEdit}
          onDeleted={onDeleted}
        />
      ),
    },
  ];
}
