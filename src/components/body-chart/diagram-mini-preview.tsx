"use client";

import { useLocale } from "next-intl";
import { getDiagramDefinition } from "@/lib/body-chart/registry";

interface DiagramMiniPreviewProps {
  diagramKey?: string | null;
  className?: string;
}

export function DiagramMiniPreview({
  diagramKey,
  className = "",
}: DiagramMiniPreviewProps) {
  const locale = useLocale();
  const diagram = getDiagramDefinition(diagramKey);
  const firstViewId = diagram.views?.[0]?.id;

  const visibleBackdrops = diagram.decorativeBackdropPaths.filter(
    (b) => !b.viewId || !firstViewId || b.viewId === firstViewId,
  );
  const visibleParts = diagram.parts.filter(
    (p) => !p.viewId || !firstViewId || p.viewId === firstViewId,
  );

  return (
    <div
      className={`rounded-xl border border-hairline bg-canvas-soft/70 p-3 dark:bg-surface-elevated/40 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground truncate">
          {locale === "ar" ? diagram.nameAr : diagram.nameEn}
        </span>
        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-medium text-primary">
          {visibleParts.length} parts
        </span>
      </div>
      <div
        dir="ltr"
        className="flex h-44 w-full items-center justify-center rounded-lg border border-border/40 bg-background/80 p-2"
      >
        <svg
          viewBox={diagram.viewBox}
          className="h-full w-full max-h-40"
          role="img"
          aria-label={diagram.nameEn}
        >
          {visibleBackdrops.map((b, i) => (
            <path
              key={i}
              d={b.d}
              fill={b.fill ?? "none"}
              stroke={b.stroke ?? "none"}
              strokeWidth={b.strokeWidth ?? 1}
              opacity={b.opacity ?? 1}
            />
          ))}
          {visibleParts.map((part) => (
            <g key={part.id}>
              {part.paths.map((d, j) => (
                <path
                  key={j}
                  d={d}
                  fill="#ffffff"
                  fillOpacity={0.85}
                  stroke="#0284c7"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {part.flowPath && (
                <path
                  d={part.flowPath}
                  fill="none"
                  stroke={part.flowTone === "venous" ? "#2563eb" : "#dc2626"}
                  strokeWidth={1.8}
                  strokeDasharray="6 6"
                  opacity={0.7}
                />
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
