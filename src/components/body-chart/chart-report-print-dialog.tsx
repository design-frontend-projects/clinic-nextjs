"use client";

import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Download, Printer } from "lucide-react";
import type {
  BodyChartData,
  DiagramDefinition,
} from "@/types/body-chart.types";
import {
  findConditionPreset,
  getPartDisplayNumber,
} from "@/lib/body-chart/registry";
import { renderAnimatedSvg } from "@/lib/body-chart/svg-serializer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChartReportPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: DiagramDefinition;
  chartData: BodyChartData;
  savedSvg?: string | null;
  patientName: string;
  doctorName?: string | null;
  clinicName?: string | null;
  version?: number;
  recordedAt?: string | null;
  overallNotes?: string | null;
}

export function ChartReportPrintDialog({
  open,
  onOpenChange,
  diagram,
  chartData,
  savedSvg,
  patientName,
  doctorName,
  clinicName,
  version,
  recordedAt,
  overallNotes,
}: ChartReportPrintDialogProps) {
  const locale = useLocale();
  const t = useTranslations("bodyChart");

  const svgMarkup = useMemo(() => {
    if (savedSvg) return savedSvg;
    return renderAnimatedSvg({
      diagram,
      chartData,
      locale: locale === "ar" ? "ar" : "en",
      meta: {
        patientName,
        doctorName,
        clinicName,
        recordedAt: recordedAt ?? new Date().toISOString(),
        version,
      },
    });
  }, [
    savedSvg,
    diagram,
    chartData,
    locale,
    patientName,
    doctorName,
    clinicName,
    recordedAt,
    version,
  ]);

  const svgBlobUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [svgMarkup]);

  useEffect(() => {
    return () => {
      if (svgBlobUrl) URL.revokeObjectURL(svgBlobUrl);
    };
  }, [svgBlobUrl]);

  const orderedAnnotations = useMemo(() => {
    return Object.values(chartData.parts)
      .map((ann) => ({
        ann,
        part: diagram.parts.find((p) => p.id === ann.partId),
      }))
      .sort(
        (a, b) => (a.part?.orderNumber ?? 999) - (b.part?.orderNumber ?? 999),
      );
  }, [chartData.parts, diagram.parts]);

  const handleDownloadSvg = () => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = patientName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `${safeName || "patient"}-${diagram.key}-v${version ?? 1}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto print:max-h-none print:border-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 pe-6">
            <div>
              <DialogTitle>{t("reportModalTitle")}</DialogTitle>
              <DialogDescription>
                {locale === "ar" ? diagram.nameAr : diagram.nameEn}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadSvg}
              >
                <Download className="me-1.5 h-4 w-4" />
                {t("downloadSvg")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="me-1.5 h-4 w-4" />
                {t("printReport")}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 rounded-xl border border-hairline bg-background p-5 print:border-0 print:p-0">
          {/* Header Metadata */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-4">
            <div className="space-y-1">
              {clinicName && (
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {clinicName}
                </p>
              )}
              <h3 className="text-lg font-bold text-foreground">
                {locale === "ar" ? diagram.nameAr : diagram.nameEn}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("patientLabel")}: <strong className="text-foreground">{patientName}</strong>
                {doctorName ? ` · ${t("doctorLabel")}: ${doctorName}` : ""}
              </p>
            </div>
            <div className="text-end text-xs text-muted-foreground">
              {version && <p className="font-mono font-semibold">v{version}</p>}
              <p>
                {format(
                  recordedAt ? new Date(recordedAt) : new Date(),
                  "MMM d, yyyy · HH:mm",
                )}
              </p>
            </div>
          </div>

          {/* Animated SVG Preview */}
          {svgBlobUrl && (
            <div dir="ltr" className="overflow-hidden rounded-lg border border-hairline bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svgBlobUrl}
                alt={diagram.nameEn}
                className="mx-auto max-h-[420px] w-full object-contain"
              />
            </div>
          )}

          {/* Overall Notes */}
          {overallNotes && (
            <div className="rounded-lg border border-hairline bg-muted/40 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("overallNotesLabel")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">
                {overallNotes}
              </p>
            </div>
          )}

          {/* Detailed Part Findings Table */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground">
              {t("detailedFindingsTitle")} ({orderedAnnotations.length})
            </h4>
            {orderedAnnotations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noMarkedParts")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-hairline">
                <table className="w-full text-start text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start">#</th>
                      <th className="px-3 py-2 text-start">{t("colPart")}</th>
                      <th className="px-3 py-2 text-start">{t("colCondition")}</th>
                      <th className="px-3 py-2 text-start">{t("colSeverity")}</th>
                      <th className="px-3 py-2 text-start">{t("colFindings")}</th>
                      <th className="px-3 py-2 text-start">{t("colTreatment")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {orderedAnnotations.map(({ ann, part }) => {
                      const preset = findConditionPreset(
                        diagram,
                        ann.conditionKey,
                      );
                      const num = part
                        ? getPartDisplayNumber(part, chartData.numberingMode)
                        : ann.partId;
                      return (
                        <tr key={ann.partId}>
                          <td className="px-3 py-2 font-mono font-bold">
                            #{num}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {part
                              ? locale === "ar"
                                ? part.labelAr
                                : part.labelEn
                              : ann.partId}
                            {ann.surfaces && ann.surfaces.length > 0 && (
                              <span className="ms-1.5 font-mono text-[10px] text-muted-foreground">
                                [{ann.surfaces.join(",")}]
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    preset?.fillHex ?? "#3b82f6",
                                }}
                              />
                              {preset
                                ? locale === "ar"
                                  ? preset.labelAr
                                  : preset.labelEn
                                : ann.conditionKey}
                            </span>
                          </td>
                          <td className="px-3 py-2 capitalize">
                            {t(`severity.${ann.severity}`)}
                          </td>
                          <td className="px-3 py-2 whitespace-pre-wrap">
                            {ann.findings || "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-pre-wrap">
                            {ann.treatmentPlan || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
