"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Eraser,
  ListChecks,
  Search,
  Stethoscope,
} from "lucide-react";
import {
  SEVERITY_LEVELS,
  TOOTH_SURFACES,
  type AnatomicalPartDefinition,
  type DiagramDefinition,
  type NumberingMode,
  type PartAnnotation,
  type PartHistoryEntry,
  type SeverityLevel,
  type ToothSurface,
} from "@/types/body-chart.types";
import {
  findConditionPreset,
  getPartDisplayNumber,
} from "@/lib/body-chart/registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PartReportPanelProps {
  diagram: DiagramDefinition;
  selectedPartId: string | null;
  activeViewId?: string;
  numberingMode?: NumberingMode;
  partsState: Record<string, PartAnnotation>;
  partHistory: PartHistoryEntry[];
  readOnly?: boolean;
  currentDoctorId?: string | null;
  currentDoctorName?: string | null;
  onSelectPart: (partId: string) => void;
  onUpsertPart: (annotation: PartAnnotation) => void;
  onClearPart: (partId: string) => void;
}

export function PartReportPanel({
  diagram,
  selectedPartId,
  activeViewId,
  numberingMode,
  partsState,
  partHistory,
  readOnly = false,
  currentDoctorId,
  currentDoctorName,
  onSelectPart,
  onUpsertPart,
  onClearPart,
}: PartReportPanelProps) {
  const locale = useLocale();
  const t = useTranslations("bodyChart");
  const [search, setSearch] = useState("");
  const [markedOnly, setMarkedOnly] = useState(false);

  const orderedParts = useMemo(() => {
    const effectiveView = activeViewId ?? diagram.views?.[0]?.id;
    return [...diagram.parts]
      .filter((p) => !p.viewId || !effectiveView || p.viewId === effectiveView)
      .sort((a, b) => a.orderNumber - b.orderNumber);
  }, [diagram, activeViewId]);

  const selectedPart: AnatomicalPartDefinition | null = useMemo(
    () =>
      selectedPartId
        ? diagram.parts.find((p) => p.id === selectedPartId) ?? null
        : null,
    [diagram.parts, selectedPartId],
  );

  const selectedIndex = selectedPart
    ? orderedParts.findIndex((p) => p.id === selectedPart.id)
    : -1;

  const existingAnnotation = selectedPart
    ? partsState[selectedPart.id]
    : undefined;

  const filteredParts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orderedParts.filter((p) => {
      if (markedOnly && !partsState[p.id]) return false;
      if (!q) return true;
      const num = getPartDisplayNumber(p, numberingMode).toLowerCase();
      return (
        num.includes(q) ||
        p.labelEn.toLowerCase().includes(q) ||
        p.labelAr.toLowerCase().includes(q)
      );
    });
  }, [orderedParts, markedOnly, partsState, search, numberingMode]);

  const updateAnnotationField = (patch: Partial<PartAnnotation>) => {
    if (!selectedPart || readOnly) return;
    const base: PartAnnotation = existingAnnotation ?? {
      partId: selectedPart.id,
      conditionKey: diagram.conditionPresets[0]?.key ?? "normal",
      severity: "moderate",
      findings: "",
      treatmentPlan: "",
      surfaces: selectedPart.supportsSurfaces ? [] : undefined,
      updatedAt: new Date().toISOString(),
      updatedById: currentDoctorId ?? null,
      updatedByName: currentDoctorName ?? null,
    };

    onUpsertPart({
      ...base,
      ...patch,
      partId: selectedPart.id,
      updatedAt: new Date().toISOString(),
      updatedById: currentDoctorId ?? base.updatedById ?? null,
      updatedByName: currentDoctorName ?? base.updatedByName ?? null,
    });
  };

  const toggleSurface = (surface: ToothSurface) => {
    if (!selectedPart?.supportsSurfaces || readOnly) return;
    const current = existingAnnotation?.surfaces ?? [];
    const next = current.includes(surface)
      ? current.filter((s) => s !== surface)
      : [...current, surface];
    updateAnnotationField({ surfaces: next });
  };

  const handleStep = (delta: -1 | 1) => {
    if (orderedParts.length === 0) return;
    if (selectedIndex < 0) {
      onSelectPart(orderedParts[0].id);
      return;
    }
    const nextIdx =
      (selectedIndex + delta + orderedParts.length) % orderedParts.length;
    onSelectPart(orderedParts[nextIdx].id);
  };

  const markedCount = Object.keys(partsState).length;

  return (
    <div className="flex h-full flex-col rounded-xl border border-hairline bg-card/80">
      <Tabs
        value={selectedPart ? "editor" : "directory"}
        onValueChange={(val) => {
          if (val === "editor" && !selectedPart && orderedParts[0]) {
            onSelectPart(orderedParts[0].id);
          }
        }}
        className="flex h-full flex-col"
      >
        <div className="border-b border-hairline px-3 py-2.5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor" className="gap-1.5 text-xs">
              <Stethoscope className="h-3.5 w-3.5" />
              <span>{t("tabPartReport")}</span>
            </TabsTrigger>
            <TabsTrigger value="directory" className="gap-1.5 text-xs">
              <ListChecks className="h-3.5 w-3.5" />
              <span>
                {t("tabPartsIndex")} ({markedCount}/{orderedParts.length})
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Selected Part Editor / Inspector */}
        <TabsContent value="editor" className="mt-0 flex-1 p-3.5">
          {!selectedPart ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Stethoscope className="h-8 w-8 opacity-40" />
              <p>{t("selectPartHint")}</p>
              {orderedParts[0] && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectPart(orderedParts[0].id)}
                >
                  {t("startFromFirst")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Part Header + Sequential Stepper */}
              <div className="flex items-start justify-between gap-2 border-b border-hairline pb-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 font-mono text-xs font-bold text-primary-foreground">
                      #{getPartDisplayNumber(selectedPart, numberingMode)}
                    </span>
                    {selectedPart.groupEn && (
                      <Badge variant="outline" className="text-[10px]">
                        {locale === "ar" && selectedPart.groupAr
                          ? selectedPart.groupAr
                          : selectedPart.groupEn}
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-sm font-bold leading-snug text-foreground">
                    {locale === "ar"
                      ? selectedPart.labelAr
                      : selectedPart.labelEn}
                  </h4>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => handleStep(-1)}
                    aria-label={t("prevPart")}
                    title={t("prevPart")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => handleStep(1)}
                    aria-label={t("nextPart")}
                    title={t("nextPart")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Condition Presets */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("conditionLabel")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {diagram.conditionPresets.map((preset) => {
                    const isActive =
                      existingAnnotation?.conditionKey === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          updateAnnotationField({ conditionKey: preset.key })
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                          isActive
                            ? "border-foreground bg-foreground text-background shadow-xs"
                            : "border-border bg-background hover:bg-muted/70",
                          readOnly && "cursor-default opacity-85",
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-white/60"
                          style={{ backgroundColor: preset.fillHex }}
                        />
                        <span>
                          {locale === "ar" ? preset.labelAr : preset.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Severity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("severityLabel")}</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SEVERITY_LEVELS.map((sev: SeverityLevel) => {
                    const active =
                      (existingAnnotation?.severity ?? "moderate") === sev;
                    return (
                      <Button
                        key={sev}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        disabled={readOnly}
                        className="h-7 text-[11px] capitalize"
                        onClick={() =>
                          updateAnnotationField({ severity: sev })
                        }
                      >
                        {t(`severity.${sev}`)}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Tooth Surfaces (Dentistry only) */}
              {selectedPart.supportsSurfaces && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {t("surfacesLabel")}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TOOTH_SURFACES.map((surface) => {
                      const active =
                        existingAnnotation?.surfaces?.includes(surface) ?? false;
                      return (
                        <Button
                          key={surface}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          disabled={readOnly}
                          className="h-7 min-w-9 px-2 font-mono text-xs"
                          onClick={() => toggleSurface(surface)}
                        >
                          {surface}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clinical Findings Report */}
              <div className="space-y-1.5">
                <Label htmlFor="part-findings" className="text-xs font-semibold">
                  {t("findingsLabel")}
                </Label>
                <Textarea
                  id="part-findings"
                  readOnly={readOnly}
                  value={existingAnnotation?.findings ?? ""}
                  onChange={(e) =>
                    updateAnnotationField({ findings: e.target.value })
                  }
                  placeholder={t("findingsPlaceholder")}
                  className="min-h-[82px] text-xs"
                />
              </div>

              {/* Treatment Plan */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="part-treatment"
                  className="text-xs font-semibold"
                >
                  {t("treatmentPlanLabel")}
                </Label>
                <Textarea
                  id="part-treatment"
                  readOnly={readOnly}
                  value={existingAnnotation?.treatmentPlan ?? ""}
                  onChange={(e) =>
                    updateAnnotationField({ treatmentPlan: e.target.value })
                  }
                  placeholder={t("treatmentPlanPlaceholder")}
                  className="min-h-[70px] text-xs"
                />
              </div>

              {!readOnly && existingAnnotation && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => onClearPart(selectedPart.id)}
                  >
                    <Eraser className="me-1.5 h-3.5 w-3.5" />
                    {t("clearPart")}
                  </Button>
                </div>
              )}

              {/* Historical Reports for This Part */}
              {partHistory.length > 0 && (
                <div className="space-y-2 border-t border-hairline pt-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t("partHistoryTitle")}</span>
                  </div>
                  <div className="max-h-40 space-y-2 overflow-y-auto pe-1">
                    {partHistory.map((h) => {
                      const preset = findConditionPreset(
                        diagram,
                        h.annotation.conditionKey,
                      );
                      return (
                        <div
                          key={h.chartId}
                          className="rounded-lg border border-hairline bg-muted/40 p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-primary">
                              v{h.version}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(h.createdAt), "MMM d, yyyy")}
                              {h.doctorName ? ` · ${h.doctorName}` : ""}
                            </span>
                          </div>
                          {preset && (
                            <p className="mt-0.5 font-medium text-foreground">
                              {locale === "ar"
                                ? preset.labelAr
                                : preset.labelEn}
                            </p>
                          )}
                          {h.annotation.findings && (
                            <p className="mt-0.5 text-muted-foreground">
                              {h.annotation.findings}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Ordered Parts Index */}
        <TabsContent value="directory" className="mt-0 flex-1 p-3">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPartsPlaceholder")}
                  className="h-8 ps-8 text-xs"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant={markedOnly ? "default" : "outline"}
                className="h-8 px-2.5 text-xs"
                onClick={() => setMarkedOnly((v) => !v)}
              >
                {t("markedOnly")} ({markedCount})
              </Button>
            </div>

            <ScrollArea className="h-[360px] pe-2">
              <div className="space-y-1.5">
                {filteredParts.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    {t("noMatchingParts")}
                  </p>
                ) : (
                  filteredParts.map((part) => {
                    const ann = partsState[part.id];
                    const preset = ann
                      ? findConditionPreset(diagram, ann.conditionKey)
                      : undefined;
                    const isSelected = selectedPartId === part.id;
                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => onSelectPart(part.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-start text-xs transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-hairline bg-background hover:bg-muted/60",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: preset?.fillHex ?? "#475569",
                            }}
                          >
                            {getPartDisplayNumber(part, numberingMode)}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {locale === "ar" ? part.labelAr : part.labelEn}
                          </span>
                        </div>
                        {preset && (
                          <Badge
                            variant={preset.badgeVariant}
                            className="shrink-0 text-[10px]"
                          >
                            {locale === "ar" ? preset.labelAr : preset.labelEn}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
