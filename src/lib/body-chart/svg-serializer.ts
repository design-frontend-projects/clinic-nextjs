import type {
  BodyChartData,
  DiagramDefinition,
} from "@/types/body-chart.types";
import { findConditionPreset, getPartDisplayNumber } from "./registry";

export interface AnimatedSvgMeta {
  patientName?: string | null;
  doctorName?: string | null;
  clinicName?: string | null;
  recordedAt?: string | null;
  version?: number;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseViewBox(viewBox: string): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const nums = viewBox
    .trim()
    .split(/\s+/)
    .map((n) => Number.parseFloat(n));
  if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
    return { minX: nums[0], minY: nums[1], width: nums[2], height: nums[3] };
  }
  return { minX: 0, minY: 0, width: 800, height: 680 };
}

/**
 * Generates a self-contained, high-resolution, animated SVG snapshot from the
 * canonical DiagramDefinition + BodyChartData JSON. All user strings are XML-
 * escaped so the output is safe for archival, download, and browser rendering.
 */
export function renderAnimatedSvg(params: {
  diagram: DiagramDefinition;
  chartData: BodyChartData;
  locale?: "en" | "ar";
  meta?: AnimatedSvgMeta;
}): string {
  const { diagram, chartData, locale = "en", meta } = params;
  const vb = parseViewBox(diagram.viewBox);
  const headerHeight = 64;
  const legendEntries = Object.values(chartData.parts);
  const legendRows = Math.max(1, Math.ceil(legendEntries.length / 2));
  const legendHeight = legendEntries.length > 0 ? 48 + legendRows * 28 : 44;
  const totalHeight = vb.height + headerHeight + legendHeight;
  const animationsOn = chartData.animationsEnabled !== false;

  const activeViewId = chartData.activeViewId ?? diagram.views?.[0]?.id;
  const visibleBackdrops = diagram.decorativeBackdropPaths.filter(
    (b) => !b.viewId || !activeViewId || b.viewId === activeViewId,
  );
  const visibleParts = diagram.parts.filter(
    (p) => !p.viewId || !activeViewId || p.viewId === activeViewId,
  );

  const titleText = escapeXml(
    locale === "ar" ? diagram.nameAr : diagram.nameEn,
  );
  const subtitleParts = [
    meta?.patientName ? `Patient: ${meta.patientName}` : null,
    meta?.doctorName ? `Doctor: ${meta.doctorName}` : null,
    meta?.version ? `v${meta.version}` : null,
    meta?.recordedAt ? meta.recordedAt.slice(0, 10) : null,
  ].filter(Boolean);
  const subtitleText = escapeXml(
    subtitleParts.join("  •  ") ||
      (locale === "ar" ? diagram.subtitleAr : diagram.subtitleEn),
  );

  const styles = `
    .bc-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .bc-part { transition: opacity 0.2s ease; }
    @keyframes bc-heartbeat {
      0%, 100% { transform: scale(1); }
      18% { transform: scale(1.022); }
      32% { transform: scale(1); }
      46% { transform: scale(1.015); }
      65% { transform: scale(1); }
    }
    @keyframes bc-pulse {
      0%, 100% { stroke-opacity: 1; fill-opacity: 0.78; }
      50% { stroke-opacity: 0.45; fill-opacity: 0.96; }
    }
    @keyframes bc-flow {
      from { stroke-dashoffset: 36; }
      to { stroke-dashoffset: 0; }
    }
    .bc-anim-heartbeat {
      transform-origin: center;
      transform-box: fill-box;
      ${animationsOn ? "animation: bc-heartbeat 1.6s ease-in-out infinite;" : ""}
    }
    .bc-anim-pulse {
      ${animationsOn ? "animation: bc-pulse 1.8s ease-in-out infinite;" : ""}
    }
    .bc-anim-flow {
      stroke-dasharray: 8 10;
      ${animationsOn ? "animation: bc-flow 1.4s linear infinite;" : ""}
    }
  `.trim();

  const backdropSvg = visibleBackdrops
    .map((b) => {
      const cls = b.className ? ` class="${escapeXml(b.className)}"` : "";
      return `<path d="${escapeXml(b.d)}" fill="${escapeXml(b.fill ?? "none")}" stroke="${escapeXml(b.stroke ?? "none")}" stroke-width="${b.strokeWidth ?? 1}" opacity="${b.opacity ?? 1}"${cls} />`;
    })
    .join("\n      ");

  const partsSvg = visibleParts
    .map((part) => {
      const annotation = chartData.parts[part.id];
      const preset = annotation
        ? findConditionPreset(diagram, annotation.conditionKey)
        : undefined;
      const fill = preset ? preset.fillHex : "#ffffff";
      const fillOpacity = preset
        ? preset.visualEffect === "missing"
          ? 0.25
          : 0.78
        : 0.88;
      const stroke = preset ? preset.strokeHex : "#64748b";
      const strokeWidth = preset ? 2.4 : 1.4;
      const effectClass =
        preset?.visualEffect === "pulse" ? " bc-anim-pulse" : "";
      const hatchAttr =
        preset?.visualEffect === "hatch"
          ? ' stroke-dasharray="5 3"'
          : preset?.visualEffect === "missing"
            ? ' stroke-dasharray="3 3"'
            : "";

      const pathsMarkup = part.paths
        .map(
          (d) =>
            `<path d="${escapeXml(d)}" fill="${escapeXml(fill)}" fill-opacity="${fillOpacity}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"${hatchAttr} class="bc-part${effectClass}" />`,
        )
        .join("");

      const flowMarkup = part.flowPath
        ? `<path d="${escapeXml(part.flowPath)}" fill="none" stroke="${
            part.flowTone === "venous"
              ? "#2563eb"
              : part.flowTone === "neural"
                ? "#9333ea"
                : "#dc2626"
          }" stroke-width="2.6" stroke-linecap="round" opacity="${
            annotation ? 0.95 : 0.55
          }" class="bc-anim-flow" />`
        : "";

      const missingCross =
        preset?.visualEffect === "missing"
          ? `<g stroke="#dc2626" stroke-width="2.5" stroke-linecap="round">
               <line x1="${part.labelAnchor.x - 9}" y1="${part.labelAnchor.y - 9}" x2="${part.labelAnchor.x + 9}" y2="${part.labelAnchor.y + 9}" />
               <line x1="${part.labelAnchor.x + 9}" y1="${part.labelAnchor.y - 9}" x2="${part.labelAnchor.x - 9}" y2="${part.labelAnchor.y + 9}" />
             </g>`
          : "";

      const badgePos = part.badgeAnchor ?? part.labelAnchor;
      const displayNum = escapeXml(
        getPartDisplayNumber(part, chartData.numberingMode),
      );
      const badgeFill = preset ? preset.fillHex : "#0f172a";
      const badgeOpacity = preset ? 1 : 0.72;
      const badgeRadius = displayNum.length > 2 ? 12 : 10;

      const badgeMarkup = `<g transform="translate(${badgePos.x}, ${badgePos.y})">
        <circle r="${badgeRadius}" fill="${escapeXml(badgeFill)}" fill-opacity="${badgeOpacity}" stroke="#ffffff" stroke-width="1.5" />
        <text text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="700" fill="#ffffff">${displayNum}</text>
      </g>`;

      const partTitle = escapeXml(
        locale === "ar" ? part.labelAr : part.labelEn,
      );

      return `<g id="${escapeXml(part.id)}">
        <title>${partTitle}</title>
        ${pathsMarkup}
        ${flowMarkup}
        ${missingCross}
        ${badgeMarkup}
      </g>`;
    })
    .join("\n      ");

  const legendItemsSvg =
    legendEntries.length === 0
      ? `<text x="24" y="${vb.height + headerHeight + 26}" font-size="12" fill="#64748b">No anatomical findings marked in this snapshot.</text>`
      : legendEntries
          .map((ann, idx) => {
            const part = diagram.parts.find((p) => p.id === ann.partId);
            const preset = findConditionPreset(diagram, ann.conditionKey);
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const x = 24 + col * ((vb.width - 48) / 2);
            const y = vb.height + headerHeight + 32 + row * 28;
            const num = part
              ? getPartDisplayNumber(part, chartData.numberingMode)
              : ann.partId;
            const partLabel = part
              ? locale === "ar"
                ? part.labelAr
                : part.labelEn
              : ann.partId;
            const condLabel = preset
              ? locale === "ar"
                ? preset.labelAr
                : preset.labelEn
              : ann.conditionKey;
            const summary = escapeXml(
              `#${num} ${partLabel} — ${condLabel}${ann.findings ? `: ${ann.findings.slice(0, 42)}` : ""}`,
            );
            return `<g transform="translate(${x}, ${y})">
              <circle cx="6" cy="-4" r="6" fill="${escapeXml(preset?.fillHex ?? "#3b82f6")}" />
              <text x="18" y="0" font-size="11" font-weight="600" fill="#0f172a">${summary}</text>
            </g>`;
          })
          .join("\n    ");

  const heartbeatWrapClass =
    diagram.ambientAnimation === "heartbeat" ? "bc-anim-heartbeat" : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.minX} ${vb.minY} ${vb.width} ${totalHeight}" width="${vb.width}" height="${totalHeight}" class="bc-root">
  <defs>
    <linearGradient id="bc-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  <style>${styles}</style>
  <rect x="${vb.minX}" y="${vb.minY}" width="${vb.width}" height="${totalHeight}" rx="16" fill="url(#bc-bg)" stroke="#e2e8f0" stroke-width="1.5" />
  <g>
    <rect x="${vb.minX}" y="${vb.minY}" width="${vb.width}" height="${headerHeight}" rx="16" fill="#0f172a" />
    <rect x="${vb.minX}" y="${vb.minY + headerHeight - 16}" width="${vb.width}" height="16" fill="#0f172a" />
    <text x="${vb.minX + 24}" y="${vb.minY + 27}" font-size="16" font-weight="700" fill="#ffffff">${titleText}</text>
    <text x="${vb.minX + 24}" y="${vb.minY + 48}" font-size="11.5" fill="#94a3b8">${subtitleText}</text>
  </g>
  <g transform="translate(0, ${headerHeight})" class="${heartbeatWrapClass}">
      ${backdropSvg}
      ${partsSvg}
  </g>
  <g>
    <line x1="${vb.minX + 20}" y1="${vb.height + headerHeight}" x2="${vb.minX + vb.width - 20}" y2="${vb.height + headerHeight}" stroke="#e2e8f0" stroke-width="1" />
    <text x="${vb.minX + 24}" y="${vb.height + headerHeight + 16}" font-size="11" font-weight="700" fill="#475569">CLINICAL FINDINGS (${legendEntries.length})</text>
    ${legendItemsSvg}
  </g>
</svg>`;
}
