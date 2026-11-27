import type {
  AnatomicalPartDefinition,
  DiagramDefinition,
} from "@/types/body-chart.types";
import { DENTISTRY_CONDITION_PRESETS } from "./presets";

interface ToothSpec {
  id: string;
  fdi: string;
  universal: string;
  orderNumber: number;
  labelEn: string;
  labelAr: string;
  kind: "incisor" | "canine" | "premolar" | "molar";
  arch: "upper" | "lower";
  quadrantSide: "right" | "left";
  /** Position along the half-arch from midline (0 = central incisor, 7 = 3rd molar) */
  slot: number;
  viewId: "adult" | "pediatric";
}

function buildToothPaths(
  cx: number,
  cy: number,
  angleDeg: number,
  kind: ToothSpec["kind"],
  arch: "upper" | "lower",
  scale = 1,
): string[] {
  const w =
    (kind === "molar"
      ? 34
      : kind === "premolar"
        ? 26
        : kind === "canine"
          ? 24
          : 22) * scale;
  const h =
    (kind === "molar"
      ? 36
      : kind === "premolar"
        ? 30
        : kind === "canine"
          ? 32
          : 28) * scale;

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rot = (lx: number, ly: number): [number, number] => [
    Number((cx + lx * cos - ly * sin).toFixed(1)),
    Number((cy + lx * sin + ly * cos).toFixed(1)),
  ];

  const hw = w / 2;
  const hh = h / 2;
  const flip = arch === "upper" ? 1 : -1;

  // Crown silhouette with realistic cusp/incisal contour
  let pts: Array<[number, number]>;
  if (kind === "molar") {
    pts = [
      [-hw * 0.88, -hh * 0.82 * flip],
      [-hw * 0.35, -hh * 1.02 * flip],
      [0, -hh * 0.86 * flip],
      [hw * 0.35, -hh * 1.02 * flip],
      [hw * 0.88, -hh * 0.82 * flip],
      [hw, 0],
      [hw * 0.82, hh * 0.88 * flip],
      [hw * 0.25, hh * 0.98 * flip],
      [0, hh * 0.82 * flip],
      [-hw * 0.25, hh * 0.98 * flip],
      [-hw * 0.82, hh * 0.88 * flip],
      [-hw, 0],
    ];
  } else if (kind === "premolar") {
    pts = [
      [-hw * 0.82, -hh * 0.82 * flip],
      [0, -hh * 1.02 * flip],
      [hw * 0.82, -hh * 0.82 * flip],
      [hw, 0],
      [hw * 0.78, hh * 0.86 * flip],
      [0, hh * flip],
      [-hw * 0.78, hh * 0.86 * flip],
      [-hw, 0],
    ];
  } else if (kind === "canine") {
    pts = [
      [-hw * 0.78, -hh * 0.75 * flip],
      [0, -hh * 1.05 * flip],
      [hw * 0.78, -hh * 0.75 * flip],
      [hw * 0.96, 0],
      [hw * 0.62, hh * 0.96 * flip],
      [0, hh * 1.12 * flip],
      [-hw * 0.62, hh * 0.96 * flip],
      [-hw * 0.96, 0],
    ];
  } else {
    pts = [
      [-hw * 0.82, -hh * 0.88 * flip],
      [0, -hh * 0.96 * flip],
      [hw * 0.82, -hh * 0.88 * flip],
      [hw * 0.92, 0],
      [hw * 0.76, hh * 0.92 * flip],
      [0, hh * 0.98 * flip],
      [-hw * 0.76, hh * 0.92 * flip],
      [-hw * 0.92, 0],
    ];
  }

  const transformed = pts.map(([x, y]) => rot(x, y));
  const crownPath =
    transformed
      .map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x} ${y}`)
      .join(" ") + " Z";

  // Subtle occlusal groove / anatomy detail inside crown
  const innerA = rot(-hw * 0.42, 0);
  const innerB = rot(hw * 0.42, 0);
  const groovePath = `M${innerA[0]} ${innerA[1]} L${innerB[0]} ${innerB[1]}`;

  return [crownPath, groovePath];
}

function getArchPlacement(
  arch: "upper" | "lower",
  side: "right" | "left",
  slot: number,
  maxSlots: number,
): { cx: number; cy: number; angleDeg: number; badgeX: number; badgeY: number } {
  // Parametric horseshoe jaw curve centered at x=440
  const centerX = 440;
  const centerY = arch === "upper" ? 295 : 385;
  const rx = maxSlots === 8 ? 255 : 215;
  const ry = maxSlots === 8 ? 205 : 175;

  // Angle from midline (PI/2 for upper top, -PI/2 for lower bottom)
  // Patient's anatomical Right is viewer's Left (x < 440).
  const t = (slot + 0.48) / (maxSlots - 0.15);
  const sweep = t * (Math.PI * 0.49);
  const signX = side === "right" ? -1 : 1;

  const cx = centerX + signX * rx * Math.sin(sweep);
  const cy =
    arch === "upper"
      ? centerY - ry * Math.cos(sweep)
      : centerY + ry * Math.cos(sweep);

  const angleDeg =
    arch === "upper"
      ? signX * ((sweep * 180) / Math.PI) * 0.82
      : -signX * ((sweep * 180) / Math.PI) * 0.82;

  const badgeOffset = maxSlots === 8 ? 40 : 38;
  const badgeX = centerX + signX * (rx + badgeOffset) * Math.sin(sweep);
  const badgeY =
    arch === "upper"
      ? centerY - (ry + badgeOffset) * Math.cos(sweep)
      : centerY + (ry + badgeOffset) * Math.cos(sweep);

  return {
    cx: Number(cx.toFixed(1)),
    cy: Number(cy.toFixed(1)),
    angleDeg: Number(angleDeg.toFixed(1)),
    badgeX: Number(badgeX.toFixed(1)),
    badgeY: Number(badgeY.toFixed(1)),
  };
}

const ADULT_TOOTH_NAMES: Array<{
  kind: ToothSpec["kind"];
  en: string;
  ar: string;
}> = [
  { kind: "incisor", en: "Central Incisor", ar: "القاطع المركزي" },
  { kind: "incisor", en: "Lateral Incisor", ar: "القاطع الجانبي" },
  { kind: "canine", en: "Canine", ar: "الناب" },
  { kind: "premolar", en: "First Premolar", ar: "الضاحك الأول" },
  { kind: "premolar", en: "Second Premolar", ar: "الضاحك الثاني" },
  { kind: "molar", en: "First Molar", ar: "الضرس الأول" },
  { kind: "molar", en: "Second Molar", ar: "الضرس الثاني" },
  { kind: "molar", en: "Third Molar (Wisdom)", ar: "ضرس العقل (الثالث)" },
];

const PEDIATRIC_TOOTH_NAMES: Array<{
  kind: ToothSpec["kind"];
  en: string;
  ar: string;
}> = [
  { kind: "incisor", en: "Primary Central Incisor", ar: "القاطع المركزي اللبني" },
  { kind: "incisor", en: "Primary Lateral Incisor", ar: "القاطع الجانبي اللبني" },
  { kind: "canine", en: "Primary Canine", ar: "الناب اللبني" },
  { kind: "molar", en: "Primary First Molar", ar: "الضرس الأول اللبني" },
  { kind: "molar", en: "Primary Second Molar", ar: "الضرس الثاني اللبني" },
];

function createAdultTeeth(): AnatomicalPartDefinition[] {
  const parts: AnatomicalPartDefinition[] = [];

  // Universal 1..32 clinical sequence: UR 8->1 (1..8), UL 1->8 (9..16), LL 8->1 (17..24), LR 1->8 (25..32)
  const quadrants: Array<{
    qNum: number;
    arch: "upper" | "lower";
    side: "right" | "left";
    archEn: string;
    archAr: string;
    sideEn: string;
    sideAr: string;
    slotStart: number;
    slotStep: number;
    universalStart: number;
  }> = [
    {
      qNum: 1,
      arch: "upper",
      side: "right",
      archEn: "Maxillary",
      archAr: "العلوي",
      sideEn: "Right",
      sideAr: "الأيمن",
      slotStart: 7,
      slotStep: -1,
      universalStart: 1,
    },
    {
      qNum: 2,
      arch: "upper",
      side: "left",
      archEn: "Maxillary",
      archAr: "العلوي",
      sideEn: "Left",
      sideAr: "الأيسر",
      slotStart: 0,
      slotStep: 1,
      universalStart: 9,
    },
    {
      qNum: 3,
      arch: "lower",
      side: "left",
      archEn: "Mandibular",
      archAr: "السفلي",
      sideEn: "Left",
      sideAr: "الأيسر",
      slotStart: 7,
      slotStep: -1,
      universalStart: 17,
    },
    {
      qNum: 4,
      arch: "lower",
      side: "right",
      archEn: "Mandibular",
      archAr: "السفلي",
      sideEn: "Right",
      sideAr: "الأيمن",
      slotStart: 0,
      slotStep: 1,
      universalStart: 25,
    },
  ];

  let order = 1;
  for (const q of quadrants) {
    for (let i = 0; i < 8; i++) {
      const slot = q.slotStart + i * q.slotStep;
      const toothMeta = ADULT_TOOTH_NAMES[slot];
      const fdi = `${q.qNum}${slot + 1}`;
      const universal = String(q.universalStart + i);
      const pos = getArchPlacement(q.arch, q.side, slot, 8);
      parts.push({
        id: `tooth_${fdi}`,
        orderNumber: order++,
        code: fdi,
        altCode: universal,
        viewId: "adult",
        groupEn: `${q.archEn} ${q.sideEn}`,
        groupAr: `الفك ${q.archAr} ${q.sideAr}`,
        labelEn: `Tooth #${fdi} — ${q.archEn} ${q.sideEn} ${toothMeta.en}`,
        labelAr: `سن #${fdi} — ${toothMeta.ar} ${q.archAr} ${q.sideAr}`,
        paths: buildToothPaths(pos.cx, pos.cy, pos.angleDeg, toothMeta.kind, q.arch, 1),
        labelAnchor: { x: pos.cx, y: pos.cy },
        badgeAnchor: { x: pos.badgeX, y: pos.badgeY },
        supportsSurfaces: true,
      });
    }
  }

  return parts;
}

function createPediatricTeeth(): AnatomicalPartDefinition[] {
  const parts: AnatomicalPartDefinition[] = [];
  const letters = "ABCDEFGHIJKLMNOPQRST";

  const quadrants: Array<{
    qNum: number;
    arch: "upper" | "lower";
    side: "right" | "left";
    archEn: string;
    archAr: string;
    sideEn: string;
    sideAr: string;
    slotStart: number;
    slotStep: number;
    letterOffset: number;
  }> = [
    {
      qNum: 5,
      arch: "upper",
      side: "right",
      archEn: "Maxillary",
      archAr: "العلوي",
      sideEn: "Right",
      sideAr: "الأيمن",
      slotStart: 4,
      slotStep: -1,
      letterOffset: 0,
    },
    {
      qNum: 6,
      arch: "upper",
      side: "left",
      archEn: "Maxillary",
      archAr: "العلوي",
      sideEn: "Left",
      sideAr: "الأيسر",
      slotStart: 0,
      slotStep: 1,
      letterOffset: 5,
    },
    {
      qNum: 7,
      arch: "lower",
      side: "left",
      archEn: "Mandibular",
      archAr: "السفلي",
      sideEn: "Left",
      sideAr: "الأيسر",
      slotStart: 4,
      slotStep: -1,
      letterOffset: 10,
    },
    {
      qNum: 8,
      arch: "lower",
      side: "right",
      archEn: "Mandibular",
      archAr: "السفلي",
      sideEn: "Right",
      sideAr: "الأيمن",
      slotStart: 0,
      slotStep: 1,
      letterOffset: 15,
    },
  ];

  let order = 1;
  for (const q of quadrants) {
    for (let i = 0; i < 5; i++) {
      const slot = q.slotStart + i * q.slotStep;
      const toothMeta = PEDIATRIC_TOOTH_NAMES[slot];
      const fdi = `${q.qNum}${slot + 1}`;
      const universal = letters[q.letterOffset + i] ?? fdi;
      const pos = getArchPlacement(q.arch, q.side, slot, 5);
      parts.push({
        id: `tooth_${fdi}`,
        orderNumber: order++,
        code: fdi,
        altCode: universal,
        viewId: "pediatric",
        groupEn: `${q.archEn} ${q.sideEn} (Primary)`,
        groupAr: `الفك ${q.archAr} ${q.sideAr} (لبني)`,
        labelEn: `Tooth #${fdi} — ${q.archEn} ${q.sideEn} ${toothMeta.en}`,
        labelAr: `سن #${fdi} — ${toothMeta.ar} ${q.archAr} ${q.sideAr}`,
        paths: buildToothPaths(pos.cx, pos.cy, pos.angleDeg, toothMeta.kind, q.arch, 0.92),
        labelAnchor: { x: pos.cx, y: pos.cy },
        badgeAnchor: { x: pos.badgeX, y: pos.badgeY },
        supportsSurfaces: true,
      });
    }
  }

  return parts;
}

const JAW_AND_TMJ_PARTS: AnatomicalPartDefinition[] = [
  {
    id: "jaw_maxilla",
    orderNumber: 33,
    code: "MAX",
    altCode: "MAX",
    groupEn: "Jaw & TMJ",
    groupAr: "الفكين والمفصل",
    labelEn: "Maxilla (Upper Jaw & Palate)",
    labelAr: "الفك العلوي وسقف الحلق",
    paths: [
      "M 275 268 C 295 162, 585 162, 605 268 C 565 245, 510 232, 440 232 C 370 232, 315 245, 275 268 Z",
    ],
    labelAnchor: { x: 440, y: 205 },
    badgeAnchor: { x: 440, y: 205 },
  },
  {
    id: "jaw_mandible",
    orderNumber: 34,
    code: "MND",
    altCode: "MND",
    groupEn: "Jaw & TMJ",
    groupAr: "الفكين والمفصل",
    labelEn: "Mandible (Lower Jaw & Gingiva)",
    labelAr: "الفك السفلي واللثة السفلية",
    paths: [
      "M 275 412 C 315 435, 370 448, 440 448 C 510 448, 565 435, 605 412 C 585 518, 295 518, 275 412 Z",
    ],
    labelAnchor: { x: 440, y: 472 },
    badgeAnchor: { x: 440, y: 472 },
  },
  {
    id: "tmj_right",
    orderNumber: 35,
    code: "TMJ-R",
    altCode: "TMJ-R",
    groupEn: "Jaw & TMJ",
    groupAr: "الفكين والمفصل",
    labelEn: "Right Temporomandibular Joint (TMJ)",
    labelAr: "المفصل الصدغي الفكي الأيمن",
    paths: [
      "M 96 340 C 96 320, 126 320, 126 340 C 126 360, 96 360, 96 340 Z",
    ],
    labelAnchor: { x: 111, y: 340 },
    badgeAnchor: { x: 111, y: 312 },
  },
  {
    id: "tmj_left",
    orderNumber: 36,
    code: "TMJ-L",
    altCode: "TMJ-L",
    groupEn: "Jaw & TMJ",
    groupAr: "الفكين والمفصل",
    labelEn: "Left Temporomandibular Joint (TMJ)",
    labelAr: "المفصل الصدغي الفكي الأيسر",
    paths: [
      "M 754 340 C 754 320, 784 320, 784 340 C 784 360, 754 360, 754 340 Z",
    ],
    labelAnchor: { x: 769, y: 340 },
    badgeAnchor: { x: 769, y: 312 },
  },
];

export const DENTISTRY_DIAGRAM: DiagramDefinition = {
  key: "dentistry",
  nameEn: "Dentistry — Jaw & Natural Teeth Chart",
  nameAr: "طب الأسنان — مخطط الفكين والأسنان الطبيعية",
  subtitleEn:
    "Interactive 32-tooth adult & 20-tooth pediatric odontogram with jaw, TMJ, FDI/Universal numbering, and 5-surface reporting.",
  subtitleAr:
    "مخطط أسنان تفاعلي للبالغين (٣٢ سنًا) والأطفال (٢٠ سنًا) مع الفكين والمفصل والترقيم العالمي وتقارير الأسطح.",
  viewBox: "0 0 880 680",
  views: [
    { id: "adult", labelEn: "Adult (32 Teeth)", labelAr: "البالغون (٣٢ سنًا)" },
    {
      id: "pediatric",
      labelEn: "Pediatric (20 Primary)",
      labelAr: "الأطفال (٢٠ سنًا لبنيًا)",
    },
  ],
  numberingModes: [
    { id: "fdi", labelEn: "FDI (11–48)", labelAr: "نظام FDI" },
    { id: "universal", labelEn: "Universal (1–32)", labelAr: "الترقيم العالمي" },
    { id: "sequential", labelEn: "Sequential", labelAr: "تسلسلي" },
  ],
  ambientAnimation: "none",
  decorativeBackdropPaths: [
    // Soft upper & lower gingival arch silhouette
    {
      d: "M 135 320 C 140 85, 740 85, 745 320 L 665 320 C 655 170, 225 170, 215 320 Z",
      fill: "#fda4af",
      stroke: "#fb7185",
      strokeWidth: 1.5,
      opacity: 0.16,
    },
    {
      d: "M 135 360 C 140 595, 740 595, 745 360 L 665 360 C 655 510, 225 510, 215 360 Z",
      fill: "#fda4af",
      stroke: "#fb7185",
      strokeWidth: 1.5,
      opacity: 0.16,
    },
    // Midline & Occlusal Axis Guides
    {
      d: "M 440 42 L 440 638",
      fill: "none",
      stroke: "#94a3b8",
      strokeWidth: 1,
      opacity: 0.45,
    },
    {
      d: "M 85 340 L 795 340",
      fill: "none",
      stroke: "#94a3b8",
      strokeWidth: 1.2,
      opacity: 0.5,
    },
    // Tongue / Oral Cavity center accent
    {
      d: "M 355 340 C 365 292, 515 292, 525 340 C 515 388, 365 388, 355 340 Z",
      fill: "#f43f5e",
      stroke: "#e11d48",
      strokeWidth: 1,
      opacity: 0.09,
    },
  ],
  conditionPresets: DENTISTRY_CONDITION_PRESETS,
  parts: [...createAdultTeeth(), ...createPediatricTeeth(), ...JAW_AND_TMJ_PARTS],
};
