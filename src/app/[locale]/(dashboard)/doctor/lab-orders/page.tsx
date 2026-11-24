"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDoctorLabOrders } from "@/app/actions/doctor";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  Eye,
  FlaskConical,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  ConfirmLabOrderDialog,
  type ConfirmableLabOrder,
} from "@/components/doctor/confirm-lab-order-dialog";

type LabOrderRow = ConfirmableLabOrder & {
  test_name: string;
  external_lab_provider: string;
  created_at: string;
};

export default function DoctorLabOrdersPage() {
  const t = useTranslations("pages.doctor.labs");
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") ?? undefined;
  const [selectedOrder, setSelectedOrder] =
    useState<ConfirmableLabOrder | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const { data: labOrders = [], isLoading } = useQuery({
    queryKey: ["doctor-lab-orders", appointmentId ?? "all"],
    queryFn: () => getDoctorLabOrders(appointmentId),
  });

  const currentProfileId = tenant?.profileId ?? null;

  const columns = useMemo<ColumnDef<LabOrderRow>[]>(
    () => [
      {
        accessorKey: "test_name",
        header: t("colTest"),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-yellow-soft text-accent-yellow font-semibold">
              <FlaskConical className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">
                {row.original.test_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.original.external_lab_provider || t("inHouse")}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "patient_name",
        header: t("colPatient"),
        cell: ({ row }) => (
          <span className="font-semibold text-sm text-foreground">
            {row.original.patient_name}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: t("colOrderDate"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.created_at), "MMM d, yyyy")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("colStatus"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "doctor_notes",
        header: t("colNotes"),
        cell: ({ row }) => {
          const { doctor_notes, status, confirmed_by_name, confirmed_at } =
            row.original;
          if (!doctor_notes && status !== "confirmed") {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="max-w-[240px] space-y-0.5">
              <p className="text-xs text-foreground line-clamp-2">
                {doctor_notes || t("noNotes")}
              </p>
              {status === "confirmed" && confirmed_at && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {t("confirmedBy", {
                    name: confirmed_by_name || t("unknownPatient"),
                    date: format(new Date(confirmed_at), "MMM d, yyyy"),
                  })}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: t("colActions"),
        cell: ({ row }) => {
          const order = row.original;
          if (order.status === "cancelled") {
            return (
              <div className="text-end text-xs text-muted-foreground">—</div>
            );
          }

          const isConfirmed = order.status === "confirmed";
          const isConfirmer =
            Boolean(currentProfileId) && order.confirmed_by === currentProfileId;

          return (
            <div className="flex items-center justify-end">
              {isConfirmed ? (
                <Button
                  variant={isConfirmer ? "outline" : "ghost"}
                  size="sm"
                  className="rounded-lg font-medium"
                  onClick={() => setSelectedOrder(order)}
                >
                  {isConfirmer ? (
                    <>
                      <Pencil className="me-1.5 h-3.5 w-3.5" />
                      {t("btnEditNotes")}
                    </>
                  ) : (
                    <>
                      <Eye className="me-1.5 h-3.5 w-3.5" />
                      {t("btnViewNotes")}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40 font-semibold"
                  onClick={() => setSelectedOrder(order)}
                >
                  <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
                  {t("btnConfirm")}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [t, currentProfileId],
  );

  const rows: LabOrderRow[] = labOrders.map((order) => ({
    id: order.id,
    test_name: order.test_name || "—",
    external_lab_provider: order.external_lab_provider || "",
    patient_name:
      `${order.patients?.first_name ?? ""} ${
        order.patients?.last_name ?? ""
      }`.trim() || t("unknownPatient"),
    created_at: order.created_at.toISOString(),
    status: order.status,
    doctor_notes: order.doctor_notes ?? null,
    confirmed_at: order.confirmed_at ? order.confirmed_at.toISOString() : null,
    confirmed_by: order.confirmed_by ?? null,
    confirmed_by_name: order.confirmer?.full_name ?? null,
    lab_results: order.lab_results,
  }));

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
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {appointmentId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border/60 bg-muted/40 px-4 py-2.5 text-sm backdrop-blur-md">
          <span className="text-muted-foreground font-medium">
            {t("showingForAppt")}
          </span>
          <Link href="/doctor/lab-orders">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg hover:bg-muted text-xs font-semibold"
            >
              <X className="mr-1.5 h-4 w-4" />
              {t("clearFilter")}
            </Button>
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
          <span className="text-sm font-medium">{t("loading")}</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-md shadow-sm">
          <DataTable
            columns={columns}
            data={rows}
            searchKey="patient_name"
            searchPlaceholder={t("searchPlaceholder")}
          />
        </div>
      )}

      <ConfirmLabOrderDialog
        labOrder={selectedOrder}
        open={selectedOrder !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedOrder(null);
        }}
        currentDoctorProfileId={currentProfileId}
        currentAppointmentId={appointmentId}
      />
    </motion.div>
  );
}
