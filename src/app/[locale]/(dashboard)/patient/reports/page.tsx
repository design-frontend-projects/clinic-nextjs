"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Activity, Loader2 } from "lucide-react";
import { getMyBodyCharts } from "@/app/actions/body-chart";
import { BodyChartStudio } from "@/components/body-chart/body-chart-studio";
import { Card, CardContent } from "@/components/ui/card";
import type {
  DiagramKey,
  PatientBodyChartContext,
  PatientBodyChartRecord,
} from "@/types/body-chart.types";

export default function PatientBodyReportsPage() {
  const t = useTranslations("pages.patient.reports");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-body-charts"],
    queryFn: () => getMyBodyCharts(),
  });

  const studioContext: PatientBodyChartContext | null = useMemo(() => {
    if (!data || data.charts.length === 0) return null;
    const latestByDiagram: Partial<Record<DiagramKey, PatientBodyChartRecord>> =
      {};
    for (const c of data.charts) {
      if (!latestByDiagram[c.diagram_key]) {
        latestByDiagram[c.diagram_key] = c;
      }
    }
    return {
      patientId: data.charts[0].patient_id,
      patientName: data.patientName,
      clinicSpecialty: null,
      doctorSpecialties: [],
      allSpecialties: [],
      defaultDiagramKey: data.charts[0].diagram_key,
      snapshots: data.charts,
      latestByDiagram,
      canEdit: false,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {t("loadError")}
          </CardContent>
        </Card>
      ) : !studioContext ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Activity className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">{t("emptyTitle")}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("emptyDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <BodyChartStudio context={studioContext} readOnly />
      )}
    </div>
  );
}
