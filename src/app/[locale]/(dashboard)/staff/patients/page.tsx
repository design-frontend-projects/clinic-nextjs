"use client";

import { useQuery } from "@tanstack/react-query";
import { getPatients } from "@/app/actions/admin";
import { invitePatientToPortal } from "@/app/actions/patient";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";
import { CreatePatientDialog } from "@/components/patients/create-patient-dialog";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Users, Mail, Loader2 } from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: Date | null;
  created_at: Date;
  profile_id: string | null;
};

function InviteToPortalCell({ patient }: { patient: Patient }) {
  const t = useTranslations("pages.staff.patients");
  const [isPending, startTransition] = useTransition();
  const [tempPasswordInfo, setTempPasswordInfo] =
    useState<TempPasswordInfo | null>(null);

  if (patient.profile_id) {
    return (
      <span className="text-xs text-muted-foreground">{t("portalActive")}</span>
    );
  }

  const handleInvite = () => {
    if (!patient.email) {
      toast.error(t("toastNoEmail"));
      return;
    }
    startTransition(async () => {
      const result = await invitePatientToPortal(patient.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.success && result.tempPassword) {
        setTempPasswordInfo({
          tempPassword: result.tempPassword,
          fullName: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim(),
          email: patient.email,
          phone: patient.phone,
        });
      }
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInvite}
        disabled={isPending || !patient.email}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Mail className="mr-2 h-3.5 w-3.5" />
        )}
        {t("inviteToPortal")}
      </Button>
      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </>
  );
}

export default function PatientsPage() {
  const t = useTranslations("pages.staff.patients");
  const tGender = useTranslations("enums.gender");

  const columns = useMemo<ColumnDef<Patient>[]>(
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
            {row.original.gender ? tGender(row.original.gender.toLowerCase()) : "—"}
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
        cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
      },
      {
        id: "portal",
        header: t("colPortal"),
        cell: ({ row }) => <InviteToPortalCell patient={row.original} />,
      },
    ],
    [t, tGender],
  );

  const { data: patients = [], refetch } = useQuery({
    queryKey: ["patients"],
    queryFn: () => getPatients(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <CreatePatientDialog
          onCreated={() => {
            void refetch();
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={patients as Patient[]}
        searchKey="first_name"
        searchPlaceholder={t("searchPlaceholder")}
      />
    </div>
  );
}
