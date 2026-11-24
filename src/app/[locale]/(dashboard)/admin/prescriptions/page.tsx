"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { getPrescriptions } from "@/app/actions/prescription";
import {
  createPrescriptionColumns,
  toPrescriptionRecord,
} from "@/components/prescriptions/prescription-columns";
import { PrescriptionDialog } from "@/components/prescriptions/prescription-dialog";
import type { PrescriptionRecord } from "@/components/prescriptions/prescription-form";
import { useTranslations } from "next-intl";

export default function AdminPrescriptionsPage() {
  const t = useTranslations("pages.doctor.prescriptions");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">(
    "create",
  );
  const [editing, setEditing] = useState<PrescriptionRecord | null>(null);

  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["prescriptions"],
    queryFn: () => getPrescriptions(),
  });

  const rows = useMemo(() => {
    return data.map((p) => ({
      id: p.id,
      patient_id: p.patient_id,
      patient_name:
        `${p.patients?.first_name ?? ""} ${p.patients?.last_name ?? ""}`.trim() ||
        t("unknownPatient"),
      doctor_name: p.profiles?.full_name ?? null,
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
  }, [data, t]);

  const columns = useMemo(
    () =>
      createPrescriptionColumns(
        {
          onView: (row) => {
            setEditing(toPrescriptionRecord(row));
            setDialogMode("view");
            setDialogOpen(true);
          },
          onEdit: (row) => {
            setEditing(toPrescriptionRecord(row));
            setDialogMode("edit");
            setDialogOpen(true);
          },
          onDeleted: () => refetch(),
        },
        t,
      ),
    [refetch, t],
  );

  function openNew() {
    setEditing(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t("btnNew")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("loading")}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="patient_name"
          searchPlaceholder={t("searchPlaceholder")}
        />
      )}

      <PrescriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prescription={editing}
        mode={dialogMode}
        onSaved={() => refetch()}
      />
    </div>
  );
}
