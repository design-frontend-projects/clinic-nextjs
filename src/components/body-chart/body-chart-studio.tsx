"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Download,
  FileText,
  History,
  Loader2,
  Redo2,
  RotateCcw,
  Save,
  Share2,
  Stethoscope,
  Undo2,
} from "lucide-react";
import {
  savePatientBodyChart,
  toggleBodyChartSharing,
} from "@/app/actions/body-chart";
import type {
  DiagramKey,
  PatientBodyChartContext,
  PatientBodyChartRecord,
} from "@/types/body-chart.types";
import {
  DIAGRAM_OPTIONS,
  extractPartHistory,
  getDiagramDefinition,
} from "@/lib/body-chart/registry";
import { renderAnimatedSvg } from "@/lib/body-chart/svg-serializer";
import { useBodyChartStore } from "@/stores/body-chart-store";
import { AnatomicalSvgCanvas } from "./anatomical-svg-canvas";
import { PartReportPanel } from "./part-report-panel";
import { ChartReportPrintDialog } from "./chart-report-print-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface BodyChartStudioHandle {
  hasUnsavedChanges: () => boolean;
  saveSnapshot: (options?: {
    encounterId?: string;
    appointmentId?: string;
    silent?: boolean;
  }) => Promise<PatientBodyChartRecord | null>;
}

interface BodyChartStudioProps {
  context: PatientBodyChartContext;
  readOnly?: boolean;
  appointmentId?: string;
  currentDoctorId?: string | null;
  currentDoctorName?: string | null;
  clinicName?: string | null;
  initialVersionId?: string | null;
  onSnapshotSaved?: (chart: PatientBodyChartRecord) => void;
}

export const BodyChartStudio = forwardRef<
  BodyChartStudioHandle,
  BodyChartStudioProps
>(function BodyChartStudio(
  {
    context,
    readOnly = false,
    appointmentId,
    currentDoctorId,
    currentDoctorName,
    clinicName,
    initialVersionId,
    onSnapshotSaved,
  },
  ref,
) {
  const locale = useLocale();
  const t = useTranslations("bodyChart");
  const queryClient = useQueryClient();

  const [snapshots, setSnapshots] = useState<PatientBodyChartRecord[]>(
    context.snapshots,
  );
  const [reportOpen, setReportOpen] = useState(false);

  const {
    diagramKey,
    activeViewId,
    visibleLayerIds,
    numberingMode,
    animationsEnabled,
    zoom,
    hoveredPartId,
    selectedPartId,
    draftParts,
    overallNotes,
    shareWithPatient,
    viewingVersionId,
    isDirty,
    past,
    future,
    hydrateFromChart,
    selectPart,
    setHoveredPart,
    upsertPartAnnotation,
    removePartAnnotation,
    setActiveView,
    toggleLayer,
    setNumberingMode,
    toggleAnimations,
    setZoom,
    resetViewport,
    setOverallNotes,
    setShareWithPatient,
    undo,
    redo,
    clearDirty,
    getSerializedChartData,
  } = useBodyChartStore();

  useEffect(() => {
    setSnapshots(context.snapshots);
  }, [context.snapshots]);

  // Initial hydration: load requested version OR latest chart for clinic's primary specialty
  useEffect(() => {
    if (initialVersionId) {
      const target = context.snapshots.find((s) => s.id === initialVersionId);
      if (target) {
        hydrateFromChart({
          diagramKey: target.diagram_key,
          chartData: target.chart_data,
          overallNotes: target.overall_notes,
          shareWithPatient: target.share_with_patient,
          viewingVersionId: readOnly ? target.id : null,
        });
        return;
      }
    }

    const latestForDefault =
      context.latestByDiagram[context.defaultDiagramKey] ??
      context.snapshots[0];

    const key = latestForDefault?.diagram_key ?? context.defaultDiagramKey;
    hydrateFromChart({
      diagramKey: key,
      chartData: latestForDefault?.chart_data ?? null,
      overallNotes: latestForDefault?.overall_notes ?? "",
      shareWithPatient: latestForDefault?.share_with_patient ?? true,
      viewingVersionId: readOnly && latestForDefault ? latestForDefault.id : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.patientId, context.defaultDiagramKey, initialVersionId, readOnly]);

  const diagram = useMemo(
    () => getDiagramDefinition(diagramKey),
    [diagramKey],
  );

  const viewingSnapshot = useMemo(
    () =>
      viewingVersionId
        ? snapshots.find((s) => s.id === viewingVersionId) ?? null
        : null,
    [snapshots, viewingVersionId],
  );

  const effectiveParts = viewingSnapshot
    ? viewingSnapshot.chart_data.parts
    : draftParts;
  const effectiveNotes = viewingSnapshot
    ? (viewingSnapshot.overall_notes ?? "")
    : overallNotes;
  const isViewingHistory = Boolean(viewingSnapshot) && !readOnly;

  const diagramSnapshots = useMemo(
    () => snapshots.filter((s) => s.diagram_key === diagramKey),
    [snapshots, diagramKey],
  );

  const partHistory = useMemo(
    () =>
      selectedPartId
        ? extractPartHistory(snapshots, selectedPartId, diagramKey)
        : [],
    [snapshots, selectedPartId, diagramKey],
  );

  const saveMutation = useMutation({
    mutationFn: savePatientBodyChart,
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSnapshots((prev) => [res.chart, ...prev]);
      clearDirty();
      queryClient.invalidateQueries({
        queryKey: ["patient-body-charts", context.patientId],
      });
      onSnapshotSaved?.(res.chart);
    },
    onError: () => {
      toast.error(t("saveFailed"));
    },
  });

  const shareMutation = useMutation({
    mutationFn: ({
      chartId,
      share,
    }: {
      chartId: string;
      share: boolean;
    }) => toggleBodyChartSharing(chartId, share),
    onSuccess: (res, vars) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSnapshots((prev) =>
        prev.map((s) =>
          s.id === vars.chartId
            ? { ...s, share_with_patient: vars.share }
            : s,
        ),
      );
      toast.success(
        vars.share ? t("sharedWithPatientOn") : t("sharedWithPatientOff"),
      );
    },
  });

  const performSave = async (options?: {
    encounterId?: string;
    appointmentId?: string;
    silent?: boolean;
  }): Promise<PatientBodyChartRecord | null> => {
    const effectiveAppointmentId = options?.appointmentId ?? appointmentId;
    if (!effectiveAppointmentId) {
      if (!options?.silent) {
        toast.error(t("saveFailed"));
      }
      return null;
    }

    const serialized = getSerializedChartData();
    const matchedSpecialty =
      context.clinicSpecialty?.diagram_key === diagramKey
        ? context.clinicSpecialty
        : context.doctorSpecialties.find((s) => s.diagram_key === diagramKey) ??
          context.allSpecialties.find((s) => s.diagram_key === diagramKey) ??
          null;

    const result = await saveMutation.mutateAsync({
      patientId: context.patientId,
      diagramKey,
      specialtyId: matchedSpecialty?.id ?? null,
      encounterId: options?.encounterId ?? null,
      appointmentId: effectiveAppointmentId,
      overallNotes: overallNotes.trim() || null,
      shareWithPatient,
      locale: locale === "ar" ? "ar" : "en",
      chartData: serialized,
    });

    if ("error" in result) {
      return null;
    }
    if (!options?.silent) {
      toast.success(t("saveSuccess", { version: result.chart.version }));
    }
    return result.chart;
  };

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => isDirty || Object.keys(draftParts).length > 0,
    saveSnapshot: performSave,
  }));

  const handleDiagramSwitch = (nextKey: DiagramKey) => {
    const latestForKey = snapshots.find((s) => s.diagram_key === nextKey);
    hydrateFromChart({
      diagramKey: nextKey,
      chartData: latestForKey?.chart_data ?? null,
      overallNotes: latestForKey?.overall_notes ?? "",
      shareWithPatient: latestForKey?.share_with_patient ?? true,
      viewingVersionId: readOnly && latestForKey ? latestForKey.id : null,
    });
  };

  const handleSelectSnapshot = (snap: PatientBodyChartRecord) => {
    hydrateFromChart({
      diagramKey: snap.diagram_key,
      chartData: snap.chart_data,
      overallNotes: snap.overall_notes,
      shareWithPatient: snap.share_with_patient,
      viewingVersionId: snap.id,
    });
  };

  const handleRestoreDraftFromSnapshot = () => {
    if (!viewingSnapshot) return;
    hydrateFromChart({
      diagramKey: viewingSnapshot.diagram_key,
      chartData: viewingSnapshot.chart_data,
      overallNotes: viewingSnapshot.overall_notes,
      shareWithPatient: viewingSnapshot.share_with_patient,
      viewingVersionId: null,
      markDirty: true,
    });
    toast.success(t("restoredToDraft"));
  };

  const handleDownloadAnimatedSvg = () => {
    const currentData = viewingSnapshot
      ? viewingSnapshot.chart_data
      : getSerializedChartData();
    const svg =
      viewingSnapshot?.animated_svg ??
      renderAnimatedSvg({
        diagram,
        chartData: currentData,
        locale: locale === "ar" ? "ar" : "en",
        meta: {
          patientName: context.patientName,
          doctorName: currentDoctorName,
          clinicName,
          recordedAt: new Date().toISOString(),
          version: (diagramSnapshots[0]?.version ?? 0) + 1,
        },
      });
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = context.patientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `${safeName || "patient"}-${diagramKey}-v${
      viewingSnapshot?.version ?? (diagramSnapshots[0]?.version ?? 0) + 1
    }.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const markedCount = Object.keys(effectiveParts).length;
  const activeChartDataForExport = viewingSnapshot
    ? viewingSnapshot.chart_data
    : getSerializedChartData();

  const availableDiagramOptions = useMemo(() => {
    if (!readOnly) return DIAGRAM_OPTIONS;
    const presentKeys = new Set(snapshots.map((s) => s.diagram_key));
    return DIAGRAM_OPTIONS.filter((opt) => presentKeys.has(opt.key));
  }, [readOnly, snapshots]);

  const showDiagramSelector = !readOnly || availableDiagramOptions.length > 1;

  return (
    <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {locale === "ar" ? diagram.nameAr : diagram.nameEn}
              </CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {t("markedCountBadge", { count: markedCount })}
              </Badge>
              {isDirty && !readOnly && !isViewingHistory && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                  {t("unsavedDraft")}
                </Badge>
              )}
            </div>
            <CardDescription>
              {locale === "ar" ? diagram.subtitleAr : diagram.subtitleEn}
            </CardDescription>
          </div>

          {/* Specialty Diagram Switcher & Exports */}
          <div className="flex flex-wrap items-center gap-2">
            {showDiagramSelector && (
              <Select
                value={diagramKey}
                onValueChange={(val) => handleDiagramSwitch(val as DiagramKey)}
              >
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableDiagramOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {locale === "ar" ? opt.nameAr : opt.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!readOnly && !isViewingHistory && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={undo}
                  disabled={past.length === 0}
                  aria-label={t("undo")}
                  title={t("undo")}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={redo}
                  disabled={future.length === 0}
                  aria-label={t("redo")}
                  title={t("redo")}
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleDownloadAnimatedSvg}
            >
              <Download className="me-1.5 h-3.5 w-3.5" />
              {t("downloadSvg")}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setReportOpen(true)}
            >
              <FileText className="me-1.5 h-3.5 w-3.5" />
              {t("viewReport")}
            </Button>
          </div>
        </div>

        {/* Visit Snapshot Timeline Strip */}
        {diagramSnapshots.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-muted/35 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              <span>{t("visitTimeline")}:</span>
            </div>

            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant={!viewingVersionId ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  const latest = diagramSnapshots[0];
                  hydrateFromChart({
                    diagramKey,
                    chartData: latest?.chart_data ?? null,
                    overallNotes: latest?.overall_notes ?? "",
                    shareWithPatient: latest?.share_with_patient ?? true,
                    viewingVersionId: null,
                  });
                }}
              >
                {t("liveDraft")}
              </Button>
            )}

            {diagramSnapshots.slice(0, 8).map((snap) => {
              const active = viewingVersionId === snap.id;
              return (
                <button
                  key={snap.id}
                  type="button"
                  onClick={() => handleSelectSnapshot(snap)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/15 font-semibold text-primary"
                      : "border-border/60 bg-background hover:bg-muted",
                  )}
                >
                  <span className="font-mono">v{snap.version}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(snap.created_at), "MMM d")}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Historical Snapshot Banner */}
        {isViewingHistory && viewingSnapshot && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-2.5 text-xs">
            <span>
              {t("viewingSnapshotBanner", {
                version: viewingSnapshot.version,
                date: format(
                  new Date(viewingSnapshot.created_at),
                  "MMM d, yyyy · HH:mm",
                ),
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() =>
                  shareMutation.mutate({
                    chartId: viewingSnapshot.id,
                    share: !viewingSnapshot.share_with_patient,
                  })
                }
              >
                <Share2 className="me-1 h-3 w-3" />
                {viewingSnapshot.share_with_patient
                  ? t("sharedBadge")
                  : t("privateBadge")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={handleRestoreDraftFromSnapshot}
              >
                <RotateCcw className="me-1 h-3 w-3" />
                {t("restoreToDraft")}
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Interactive Split Workspace */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <AnatomicalSvgCanvas
              diagram={diagram}
              partsState={effectiveParts}
              selectedPartId={selectedPartId}
              hoveredPartId={hoveredPartId}
              activeViewId={
                viewingSnapshot
                  ? viewingSnapshot.chart_data.activeViewId
                  : activeViewId
              }
              visibleLayerIds={visibleLayerIds}
              numberingMode={
                viewingSnapshot
                  ? viewingSnapshot.chart_data.numberingMode
                  : numberingMode
              }
              animationsEnabled={animationsEnabled}
              zoom={zoom}
              onSelectPart={selectPart}
              onHoverPart={setHoveredPart}
              onViewChange={setActiveView}
              onToggleLayer={toggleLayer}
              onNumberingChange={setNumberingMode}
              onToggleAnimations={toggleAnimations}
              onZoomChange={setZoom}
              onResetViewport={resetViewport}
            />
          </div>

          <div className="lg:col-span-5">
            <PartReportPanel
              diagram={diagram}
              selectedPartId={selectedPartId}
              activeViewId={
                viewingSnapshot
                  ? viewingSnapshot.chart_data.activeViewId
                  : activeViewId
              }
              numberingMode={
                viewingSnapshot
                  ? viewingSnapshot.chart_data.numberingMode
                  : numberingMode
              }
              partsState={effectiveParts}
              partHistory={partHistory}
              readOnly={readOnly || isViewingHistory}
              currentDoctorId={currentDoctorId}
              currentDoctorName={currentDoctorName}
              onSelectPart={selectPart}
              onUpsertPart={upsertPartAnnotation}
              onClearPart={removePartAnnotation}
            />
          </div>
        </div>

        {/* Footer: Overall Summary + Save Controls */}
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-muted/30 p-3.5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="bc-overall-notes" className="text-xs font-semibold">
              {t("overallNotesLabel")}
            </Label>
            <Textarea
              id="bc-overall-notes"
              readOnly={readOnly || isViewingHistory}
              value={effectiveNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              placeholder={t("overallNotesPlaceholder")}
              className="min-h-[60px] bg-background/80 text-xs"
            />
          </div>

          {!readOnly && !isViewingHistory && (
            <div className="flex flex-col gap-2.5 sm:items-end">
              <div className="flex items-center gap-2">
                <Switch
                  id="bc-share-patient"
                  checked={shareWithPatient}
                  onCheckedChange={setShareWithPatient}
                />
                <Label
                  htmlFor="bc-share-patient"
                  className="cursor-pointer text-xs"
                >
                  {t("shareWithPatientLabel")}
                </Label>
              </div>

              <Button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => void performSave()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                {t("saveSnapshotBtn")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      <ChartReportPrintDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        diagram={diagram}
        chartData={activeChartDataForExport}
        savedSvg={viewingSnapshot?.animated_svg}
        patientName={context.patientName}
        doctorName={viewingSnapshot?.doctor_name ?? currentDoctorName}
        clinicName={clinicName}
        version={
          viewingSnapshot?.version ?? (diagramSnapshots[0]?.version ?? 0) + 1
        }
        recordedAt={viewingSnapshot?.created_at}
        overallNotes={effectiveNotes}
      />
    </Card>
  );
});
