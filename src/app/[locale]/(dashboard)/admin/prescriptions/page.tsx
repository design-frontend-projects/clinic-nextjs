"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { getPrescriptions } from "@/app/actions/prescription";
import {
  createPrescriptionColumns,
  type PrescriptionRow,
} from "@/components/prescriptions/prescription-columns";
import { PrescriptionDialog } from "@/components/prescriptions/prescription-dialog";
import type { PrescriptionRecord } from "@/components/prescriptions/prescription-form";

type PrescriptionsResult = Awaited<ReturnType<typeof getPrescriptions>>;

function toRows(data: PrescriptionsResult): PrescriptionRow[] {
  return data.map((p) => ({
    id: p.id,
    patient_id: p.patient_id,
    patient_name:
      `${p.patients?.first_name ?? ""} ${p.patients?.last_name ?? ""}`.trim() ||
      "Unknown patient",
    diagnosis: p.diagnosis,
    notes: p.notes,
    status: p.status,
    issued_at: p.issued_at,
    prescription_items: p.prescription_items.map((item) => ({
      medication_id: item.medication_id,
      medication_name: item.medication_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route,
      quantity: item.quantity,
      instructions: item.instructions,
    })),
  }));
}

export default function AdminPrescriptionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PrescriptionRecord | null>(null);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["prescriptions"],
    queryFn: () => getPrescriptions(),
  });

  const rows = useMemo(() => toRows(data), [data]);

  const columns = useMemo(
    () =>
      createPrescriptionColumns({
        onEdit: (row) => {
          setEditing({
            id: row.id,
            patient_id: row.patient_id,
            diagnosis: row.diagnosis,
            notes: row.notes,
            status: row.status,
            prescription_items: row.prescription_items,
          });
          setDialogOpen(true);
        },
        onDeleted: () => refetch(),
      }),
    [refetch],
  );

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prescriptions</h1>
          <p className="text-muted-foreground">
            Manage your issued patient prescriptions
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Prescription
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading prescriptions...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="patient_name"
          searchPlaceholder="Search by patient name..."
        />
      )}

      <PrescriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prescription={editing}
        onSaved={() => refetch()}
      />
    </div>
  );
}
