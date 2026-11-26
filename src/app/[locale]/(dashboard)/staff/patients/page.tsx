"use client";

import { useQuery } from "@tanstack/react-query";
import { getPatients } from "@/app/actions/admin";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";
import { CreatePatientDialog } from "@/components/patients/create-patient-dialog";
import { InviteToPortalButton } from "@/components/patients/invite-to-portal-button";
import { PatientDetailsDialog } from "@/components/patients/patient-details-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import type { PatientRow } from "@/types/patient.types";

export default function PatientsPage() {
  const t = useTranslations("pages.staff.patients");
  const tGender = useTranslations("enums.gender");
  const tDetails = useTranslations("patients.details");
  const [tempPasswordInfo, setTempPasswordInfo] =
    useState<TempPasswordInfo | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );

  const { data: patients = [], refetch } = useQuery({
    queryKey: ["patients"],
    queryFn: () => getPatients(),
  });

  const handleInvited = useCallback(
    (info: TempPasswordInfo) => {
      setTempPasswordInfo(info);
      void refetch();
    },
    [refetch],
  );

  const selectedPatient = useMemo(
    () =>
      (patients as PatientRow[]).find((p) => p.id === selectedPatientId) ??
      null,
    [patients, selectedPatientId],
  );

  const columns = useMemo<ColumnDef<PatientRow>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: t("colName"),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {row.original.first_name} {row.original.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.original.email || t("noEmail")}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: t("colPhone"),
        cell: ({ row }) => row.original.phone || "—",
      },
      {
        accessorKey: "gender",
        header: t("colGender"),
        cell: ({ row }) => (
          <span className="capitalize">
            {row.original.gender
              ? tGender(row.original.gender.toLowerCase())
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "date_of_birth",
        header: t("colDob"),
        cell: ({ row }) =>
          row.original.date_of_birth
            ? format(new Date(row.original.date_of_birth), "MMM d, yyyy")
            : "—",
      },
      {
        accessorKey: "created_at",
        header: t("colRegistered"),
        cell: ({ row }) =>
          format(new Date(row.original.created_at), "MMM d, yyyy"),
      },
      {
        id: "portal",
        header: t("colPortal"),
        cell: ({ row }) => (
          <InviteToPortalButton
            patient={row.original}
            onInvited={handleInvited}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPatientId(row.original.id)}
          >
            <Eye className="me-1.5 h-3.5 w-3.5" />
            {tDetails("view")}
          </Button>
        ),
      },
    ],
    [t, tGender, tDetails, handleInvited],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreatePatientDialog
          onCreated={() => {
            void refetch();
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={patients as PatientRow[]}
        searchKey="first_name"
        searchPlaceholder={t("searchPlaceholder")}
        getRowId={(row) => row.id}
        onRowClick={(row) => setSelectedPatientId(row.id)}
      />

      <PatientDetailsDialog
        patient={selectedPatient}
        onOpenChange={(open) => {
          if (!open) setSelectedPatientId(null);
        }}
        onInvited={handleInvited}
        onPasswordGenerated={setTempPasswordInfo}
      />
      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </div>
  );
}
