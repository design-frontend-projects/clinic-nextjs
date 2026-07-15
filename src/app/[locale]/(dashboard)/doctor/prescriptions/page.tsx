"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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

export default function DoctorPrescriptionsPage() {
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent">
            Prescriptions
          </h1>
          <p className="text-muted-foreground">
            Manage your issued patient prescriptions
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={openNew} className="rounded-xl font-medium shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            New Prescription
          </Button>
        </motion.div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          <span className="text-sm font-medium">Loading prescriptions...</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-md shadow-sm animate-fade-in">
          <DataTable
            columns={columns}
            data={rows}
            searchKey="patient_name"
            searchPlaceholder="Search by patient name..."
          />
        </div>
      )}

      <PrescriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prescription={editing}
        onSaved={() => refetch()}
      />
    </motion.div>
  );
}
