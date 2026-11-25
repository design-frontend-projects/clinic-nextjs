"use client";

import { useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ban, CheckCircle2, Loader2, Pill, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClinicMedicines,
  resumeClinicMedicine,
} from "@/app/actions/medicine";
import {
  MEDICINE_CATEGORIES,
  type ClinicMedicineCounts,
  type ClinicMedicineRecord,
} from "@/types/medication.types";
import { createMedicineColumns } from "./medicine-columns";
import { MedicineFormDialog } from "./medicine-form-dialog";
import { StopMedicineDialog } from "./stop-medicine-dialog";

interface MedicinesManagementClientProps {
  initialMedicines: ClinicMedicineRecord[];
  initialCounts: ClinicMedicineCounts;
}

type StatusTab = "active" | "stopped" | "all";

export function MedicinesManagementClient({
  initialMedicines,
  initialCounts,
}: MedicinesManagementClientProps) {
  const t = useTranslations("medicines");
  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedMedicine, setSelectedMedicine] =
    useState<ClinicMedicineRecord | null>(null);

  const [stopTarget, setStopTarget] = useState<ClinicMedicineRecord | null>(
    null,
  );
  const [, startResumeTransition] = useTransition();

  const { data, isLoading } = useQuery({
    queryKey: ["clinicMedicines"],
    queryFn: async () => {
      const res = await getClinicMedicines();
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    initialData: {
      medicines: initialMedicines,
      counts: initialCounts,
    },
  });

  const medicines = data?.medicines ?? initialMedicines;
  const counts = data?.counts ?? initialCounts;

  const filteredMedicines = useMemo(() => {
    return medicines.filter((med) => {
      if (statusTab === "active" && !med.is_active) return false;
      if (statusTab === "stopped" && med.is_active) return false;
      if (categoryFilter !== "all" && med.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [medicines, statusTab, categoryFilter]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["clinicMedicines"] });
    queryClient.invalidateQueries({ queryKey: ["prescriptionCatalog"] });
  }

  function handleOpenCreate() {
    setSelectedMedicine(null);
    setFormMode("create");
    setFormOpen(true);
  }

  function handleResume(med: ClinicMedicineRecord) {
    startResumeTransition(async () => {
      const res = await resumeClinicMedicine(med.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toastResumed"));
      invalidateAll();
    });
  }

  const columns = useMemo(
    () =>
      createMedicineColumns(
        {
          onView: (med) => {
            setSelectedMedicine(med);
            setFormMode("view");
            setFormOpen(true);
          },
          onEdit: (med) => {
            setSelectedMedicine(med);
            setFormMode("edit");
            setFormOpen(true);
          },
          onStop: (med) => {
            setStopTarget(med);
          },
          onResume: handleResume,
        },
        t,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={handleOpenCreate} className="rounded-xl font-medium">
          <Plus className="me-2 h-4 w-4" />
          {t("addButton")}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title={t("kpi.total")}
          value={counts.total}
          icon={Pill}
        />
        <StatCard
          title={t("kpi.active")}
          value={counts.active}
          icon={CheckCircle2}
        />
        <StatCard
          title={t("kpi.stopped")}
          value={counts.stopped}
          icon={Ban}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={statusTab}
          onValueChange={(val) => setStatusTab(val as StatusTab)}
        >
          <TabsList>
            <TabsTrigger value="active">
              {t("tabs.active", { count: counts.active })}
            </TabsTrigger>
            <TabsTrigger value="stopped">
              {t("tabs.stopped", { count: counts.stopped })}
            </TabsTrigger>
            <TabsTrigger value="all">
              {t("tabs.all", { count: counts.total })}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("filters.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allCategories")}</SelectItem>
            {MEDICINE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {t(`categories.${cat}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading && medicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredMedicines}
          searchKey="medicine"
          searchPlaceholder={t("searchPlaceholder")}
        />
      )}

      {/* Add / Edit / View Dialog */}
      <MedicineFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        medicine={selectedMedicine}
        onSaved={() => invalidateAll()}
      />

      {/* Stop Confirmation Dialog */}
      <StopMedicineDialog
        open={stopTarget !== null}
        onOpenChange={(next) => {
          if (!next) setStopTarget(null);
        }}
        medicine={stopTarget}
        onStopped={() => invalidateAll()}
      />
    </motion.div>
  );
}
