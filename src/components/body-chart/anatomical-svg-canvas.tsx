"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  DiagramDefinition,
  NumberingMode,
  PartAnnotation,
} from "@/types/body-chart.types";
import {
  findConditionPreset,
  getPartDisplayNumber,
} from "@/lib/body-chart/registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AnatomicalSvgCanvasProps {
  diagram: DiagramDefinition;
  partsState: Record<string, PartAnnotation>;
  selectedPartId: string | null;
  hoveredPartId: string | null;
  activeViewId?: string;
  visibleLayerIds: string[];
  numberingMode?: NumberingMode;
  animationsEnabled: boolean;
  zoom: number;
  onSelectPart: (partId: string) => void;
  onHoverPart: (partId: string | null) => void;
  onViewChange: (viewId: string) => void;
  onToggleLayer: (layerId: string) => void;
  onNumberingChange: (mode: NumberingMode) => void;
  onToggleAnimations: () => void;
  onZoomChange: (zoom: number) => void;
  onResetViewport: () => void;
}

export function AnatomicalSvgCanvas({
  diagram,
  partsState,
  selectedPartId,
  hoveredPartId,
  activeViewId,
  visibleLayerIds,
  numberingMode,
  animationsEnabled,
  zoom,
  onSelectPart,
  onHoverPart,
  onViewChange,
  onToggleLayer,
  onNumberingChange,
  onToggleAnimations,
  onZoomChange,
  onResetViewport,
}: AnatomicalSvgCanvasProps) {
  const locale = useLocale();
  const t = useTranslations("bodyChart");
  const [fullscreen, setFullscreen] = useState(false);

  const effectiveViewId = activeViewId ?? diagram.views?.[0]?.id;
  const layerSet = new Set(visibleLayerIds);

  const visibleBackdrops = diagram.decorativeBackdropPaths.filter((b) => {
    if (b.viewId && effectiveViewId && b.viewId !== effectiveViewId) {
      return false;
    }
    if (b.layerId && layerSet.size > 0 && !layerSet.has(b.layerId)) {
      return false;
    }
    return true;
  });

  const visibleParts = diagram.parts.filter((p) => {
    if (p.viewId && effectiveViewId && p.viewId !== effectiveViewId) {
      return false;
    }
    if (p.layerId && layerSet.size > 0 && !layerSet.has(p.layerId)) {
      return false;
    }
    return true;
  });

  const hoveredPart = hoveredPartId
    ? diagram.parts.find((p) => p.id === hoveredPartId)
    : null;
  const hoveredAnnotation = hoveredPartId ? partsState[hoveredPartId] : null;
  const hoveredPreset = hoveredAnnotation
    ? findConditionPreset(diagram, hoveredAnnotation.conditionKey)
    : undefined;

  const renderSvgContent = (isExpanded: boolean) => (
    <div
      dir="ltr"
      className={cn(
        "relative overflow-auto rounded-xl border border-hairline bg-linear-to-b from-slate-50/90 to-white dark:from-slate-950/70 dark:to-slate-900/90",
        isExpanded ? "h-[72vh]" : "h-[430px] sm:h-[490px]",
      )}
    >
      {/* Floating Hover Tooltip */}
      {hoveredPart && (
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="pointer-events-none sticky top-2 z-20 mx-3 mt-2 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-border/60 bg-background/95 px-3 py-1.5 text-xs shadow-md backdrop-blur-sm"
        >
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[11px] font-bold text-primary-foreground">
            {getPartDisplayNumber(hoveredPart, numberingMode)}
          </span>
          <span className="truncate font-semibold text-foreground">
            {locale === "ar" ? hoveredPart.labelAr : hoveredPart.labelEn}
          </span>
          {hoveredPreset && (
            <Badge
              variant={hoveredPreset.badgeVariant}
              className="shrink-0 text-[10px]"
              style={{
                borderColor: hoveredPreset.strokeHex,
              }}
            >
              {locale === "ar" ? hoveredPreset.labelAr : hoveredPreset.labelEn}
            </Badge>
          )}
        </div>
      )}

      <div className="flex min-h-full min-w-full items-center justify-center p-3">
        <motion.svg
          viewBox={diagram.viewBox}
          style={{
            width: `${Math.round(zoom * 100)}%`,
            maxWidth: `${Math.round(zoom * 780)}px`,
          }}
          className="h-auto select-none transition-[width] duration-200"
          role="img"
          aria-label={locale === "ar" ? diagram.nameAr : diagram.nameEn}
          animate={
            animationsEnabled && diagram.ambientAnimation === "heartbeat"
              ? { scale: [1, 1.016, 1, 1.01, 1] }
              : animationsEnabled && diagram.ambientAnimation === "breathing"
                ? { scale: [1, 1.01, 1] }
                : { scale: 1 }
          }
          transition={
            animationsEnabled &&
            (diagram.ambientAnimation === "heartbeat" ||
              diagram.ambientAnimation === "breathing")
              ? {
                  duration: diagram.ambientAnimation === "heartbeat" ? 1.5 : 3.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : undefined
          }
        >
          <defs>
            <filter id="bc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="4"
                floodColor="#0284c7"
                floodOpacity="0.45"
              />
            </filter>
          </defs>

          {/* Anatomical Backdrop */}
          <g>
            {visibleBackdrops.map((b, idx) => (
              <path
                key={idx}
                d={b.d}
                fill={b.fill ?? "none"}
                stroke={b.stroke ?? "none"}
                strokeWidth={b.strokeWidth ?? 1}
                opacity={b.opacity ?? 1}
              />
            ))}
          </g>

          {/* Selectable Anatomical Parts */}
          <g>
            {visibleParts.map((part) => {
              const annotation = partsState[part.id];
              const preset = annotation
                ? findConditionPreset(diagram, annotation.conditionKey)
                : undefined;
              const isSelected = selectedPartId === part.id;
              const isHovered = hoveredPartId === part.id;
              const isMissing = preset?.visualEffect === "missing";
              const isPulse =
                animationsEnabled && preset?.visualEffect === "pulse";

              const fill = preset
                ? preset.fillHex
                : isHovered
                  ? "#e0f2fe"
                  : "#ffffff";
              const fillOpacity = preset
                ? isMissing
                  ? 0.25
                  : 0.78
                : isHovered
                  ? 0.95
                  : 0.88;
              const stroke = isSelected
                ? "#0284c7"
                : preset
                  ? preset.strokeHex
                  : isHovered
                    ? "#0284c7"
                    : "#64748b";
              const strokeWidth = isSelected ? 3.2 : preset ? 2.4 : 1.5;

              const badgePos = part.badgeAnchor ?? part.labelAnchor;
              const displayNum = getPartDisplayNumber(part, numberingMode);
              const badgeRadius = displayNum.length > 2 ? 12.5 : 10.5;

              return (
                <motion.g
                  key={part.id}
                  onClick={() => onSelectPart(part.id)}
                  onMouseEnter={() => onHoverPart(part.id)}
                  onMouseLeave={() => onHoverPart(null)}
                  className="cursor-pointer outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={locale === "ar" ? part.labelAr : part.labelEn}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectPart(part.id);
                    }
                  }}
                  animate={
                    isPulse
                      ? { opacity: [0.8, 1, 0.8] }
                      : { opacity: 1 }
                  }
                  transition={
                    isPulse
                      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                      : undefined
                  }
                  filter={isSelected ? "url(#bc-glow)" : undefined}
                >
                  {part.paths.map((d, idx) => (
                    <path
                      key={idx}
                      d={d}
                      fill={fill}
                      fillOpacity={fillOpacity}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={
                        preset?.visualEffect === "hatch"
                          ? "5 3"
                          : isMissing
                            ? "3 3"
                            : undefined
                      }
                    />
                  ))}

                  {/* Animated Vascular / Neural Flow Streamline */}
                  {part.flowPath && (
                    <motion.path
                      d={part.flowPath}
                      fill="none"
                      stroke={
                        part.flowTone === "venous"
                          ? "#2563eb"
                          : part.flowTone === "neural"
                            ? "#9333ea"
                            : "#dc2626"
                      }
                      strokeWidth={isSelected ? 3.4 : 2.5}
                      strokeLinecap="round"
                      strokeDasharray="8 10"
                      opacity={annotation || isSelected ? 0.95 : 0.55}
                      animate={
                        animationsEnabled
                          ? { strokeDashoffset: [36, 0] }
                          : undefined
                      }
                      transition={
                        animationsEnabled
                          ? {
                              duration: 1.35,
                              repeat: Infinity,
                              ease: "linear",
                            }
                          : undefined
                      }
                    />
                  )}

                  {/* Missing Tooth / Absent Structure X */}
                  {isMissing && (
                    <g
                      stroke="#dc2626"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      pointerEvents="none"
                    >
                      <line
                        x1={part.labelAnchor.x - 9}
                        y1={part.labelAnchor.y - 9}
                        x2={part.labelAnchor.x + 9}
                        y2={part.labelAnchor.y + 9}
                      />
                      <line
                        x1={part.labelAnchor.x + 9}
                        y1={part.labelAnchor.y - 9}
                        x2={part.labelAnchor.x - 9}
                        y2={part.labelAnchor.y + 9}
                      />
                    </g>
                  )}

                  {/* Selection Ripple Ring */}
                  {isSelected && (
                    <motion.circle
                      cx={badgePos.x}
                      cy={badgePos.y}
                      r={badgeRadius + 5}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth={2}
                      initial={{ scale: 0.85, opacity: 0.9 }}
                      animate={
                        animationsEnabled
                          ? { scale: [1, 1.25, 1], opacity: [0.9, 0.25, 0.9] }
                          : { scale: 1, opacity: 0.9 }
                      }
                      transition={
                        animationsEnabled
                          ? { duration: 1.6, repeat: Infinity }
                          : undefined
                      }
                    />
                  )}

                  {/* Numbered Callout Badge */}
                  <g transform={`translate(${badgePos.x}, ${badgePos.y})`}>
                    <circle
                      r={badgeRadius}
                      fill={
                        isSelected
                          ? "#0284c7"
                          : preset
                            ? preset.fillHex
                            : "#0f172a"
                      }
                      fillOpacity={isSelected || preset ? 1 : 0.72}
                      stroke="#ffffff"
                      strokeWidth={1.6}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="9.5"
                      fontWeight="700"
                      fill="#ffffff"
                      pointerEvents="none"
                    >
                      {displayNum}
                    </text>
                  </g>
                </motion.g>
              );
            })}
          </g>
        </motion.svg>
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline bg-muted/40 p-2">
      {/* Views / Layers / Numbering */}
      <div className="flex flex-wrap items-center gap-1.5">
        {diagram.views && diagram.views.length > 0 && (
          <div className="flex items-center rounded-lg border border-border/50 bg-background p-0.5">
            {diagram.views.map((v) => (
              <Button
                key={v.id}
                type="button"
                size="sm"
                variant={effectiveViewId === v.id ? "default" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => onViewChange(v.id)}
              >
                {locale === "ar" ? v.labelAr : v.labelEn}
              </Button>
            ))}
          </div>
        )}

        {diagram.layers && diagram.layers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {diagram.layers.map((layer) => {
              const active = layerSet.has(layer.id);
              return (
                <Button
                  key={layer.id}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => onToggleLayer(layer.id)}
                >
                  {locale === "ar" ? layer.labelAr : layer.labelEn}
                </Button>
              );
            })}
          </div>
        )}

        {diagram.numberingModes && diagram.numberingModes.length > 0 && (
          <div className="flex items-center rounded-lg border border-border/50 bg-background p-0.5">
            {diagram.numberingModes.map((nm) => (
              <Button
                key={nm.id}
                type="button"
                size="sm"
                variant={numberingMode === nm.id ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => onNumberingChange(nm.id)}
              >
                {locale === "ar" ? nm.labelAr : nm.labelEn}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Viewport & Animation Controls */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={() => onZoomChange(zoom - 0.25)}
          disabled={zoom <= 0.75}
          aria-label={t("zoomOut")}
          title={t("zoomOut")}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[44px] text-center font-mono text-[11px] font-medium text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={() => onZoomChange(zoom + 0.25)}
          disabled={zoom >= 2.5}
          aria-label={t("zoomIn")}
          title={t("zoomIn")}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={onResetViewport}
          aria-label={t("resetView")}
          title={t("resetView")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={animationsEnabled ? "secondary" : "outline"}
          className="h-7 gap-1 px-2 text-xs"
          onClick={onToggleAnimations}
        >
          {animationsEnabled ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">
            {animationsEnabled ? t("animationOn") : t("animationOff")}
          </span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
          title={fullscreen ? t("exitFullscreen") : t("fullscreen")}
        >
          {fullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-2.5">
        {toolbar}
        {renderSvgContent(false)}
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-5xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? diagram.nameAr : diagram.nameEn}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            {toolbar}
            {renderSvgContent(true)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
