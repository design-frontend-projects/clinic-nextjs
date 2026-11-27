import {
  DIAGRAM_KEYS,
  type AnatomicalPartDefinition,
  type BodyChartData,
  type DiagramDefinition,
  type DiagramKey,
  type NumberingMode,
  type PartConditionPreset,
  type PartHistoryEntry,
  type PatientBodyChartRecord,
} from "@/types/body-chart.types";
import { CARDIOLOGY_DIAGRAM } from "./atlases/cardiology";
import { DENTISTRY_DIAGRAM } from "./atlases/dentistry";
import {
  DERMATOLOGY_DIAGRAM,
  GENERAL_BODY_DIAGRAM,
  GENERAL_PRACTICE_DIAGRAM,
  INTERNAL_MEDICINE_DIAGRAM,
  PEDIATRICS_DIAGRAM,
} from "./atlases/general-and-internal";
import { ENT_DIAGRAM, OPHTHALMOLOGY_DIAGRAM } from "./atlases/head-sensory";
import {
  NEUROLOGY_DIAGRAM,
  ORTHOPEDICS_DIAGRAM,
  PSYCHIATRY_DIAGRAM,
} from "./atlases/musculoskeletal-neuro";
import {
  ENDOCRINOLOGY_DIAGRAM,
  GASTROENTEROLOGY_DIAGRAM,
  GYNECOLOGY_DIAGRAM,
  UROLOGY_DIAGRAM,
} from "./atlases/visceral-specialties";

export const DIAGRAM_REGISTRY: Record<DiagramKey, DiagramDefinition> = {
  dentistry: DENTISTRY_DIAGRAM,
  cardiology: CARDIOLOGY_DIAGRAM,
  general_practice: GENERAL_PRACTICE_DIAGRAM,
  internal_medicine: INTERNAL_MEDICINE_DIAGRAM,
  dermatology: DERMATOLOGY_DIAGRAM,
  pediatrics: PEDIATRICS_DIAGRAM,
  orthopedics: ORTHOPEDICS_DIAGRAM,
  neurology: NEUROLOGY_DIAGRAM,
  ent: ENT_DIAGRAM,
  ophthalmology: OPHTHALMOLOGY_DIAGRAM,
  gynecology: GYNECOLOGY_DIAGRAM,
  psychiatry: PSYCHIATRY_DIAGRAM,
  urology: UROLOGY_DIAGRAM,
  gastroenterology: GASTROENTEROLOGY_DIAGRAM,
  endocrinology: ENDOCRINOLOGY_DIAGRAM,
  general_body: GENERAL_BODY_DIAGRAM,
};

export const DIAGRAM_OPTIONS = DIAGRAM_KEYS.map((key) => {
  const def = DIAGRAM_REGISTRY[key];
  return {
    key,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
  };
});

const SPECIALTY_NAME_TO_DIAGRAM: Record<string, DiagramKey> = {
  dentistry: "dentistry",
  cardiology: "cardiology",
  "general practice": "general_practice",
  "internal medicine": "internal_medicine",
  dermatology: "dermatology",
  pediatrics: "pediatrics",
  orthopedics: "orthopedics",
  neurology: "neurology",
  ent: "ent",
  ophthalmology: "ophthalmology",
  gynecology: "gynecology",
  psychiatry: "psychiatry",
  urology: "urology",
  gastroenterology: "gastroenterology",
  endocrinology: "endocrinology",
};

export function isDiagramKey(value: unknown): value is DiagramKey {
  return (
    typeof value === "string" &&
    (DIAGRAM_KEYS as readonly string[]).includes(value)
  );
}

export function getDiagramDefinition(
  key?: string | null,
): DiagramDefinition {
  if (key && isDiagramKey(key)) {
    return DIAGRAM_REGISTRY[key];
  }
  return DIAGRAM_REGISTRY.general_body;
}

export function resolveDiagramKeyForSpecialty(
  specialty?: {
    diagram_key?: string | null;
    name?: string | null;
  } | null,
): DiagramKey {
  if (!specialty) return "general_body";
  if (
    specialty.diagram_key &&
    specialty.diagram_key !== "general_body" &&
    isDiagramKey(specialty.diagram_key)
  ) {
    return specialty.diagram_key;
  }
  const normalized = specialty.name?.trim().toLowerCase();
  if (normalized && normalized in SPECIALTY_NAME_TO_DIAGRAM) {
    return SPECIALTY_NAME_TO_DIAGRAM[normalized];
  }
  if (specialty.diagram_key && isDiagramKey(specialty.diagram_key)) {
    return specialty.diagram_key;
  }
  return "general_body";
}

export function getPartDisplayNumber(
  part: AnatomicalPartDefinition,
  numberingMode?: NumberingMode,
): string {
  if (numberingMode === "universal" && part.altCode) {
    return part.altCode;
  }
  if (numberingMode === "fdi" && part.code) {
    return part.code;
  }
  if (numberingMode === "sequential") {
    return String(part.orderNumber);
  }
  return part.code ?? String(part.orderNumber);
}

export function findConditionPreset(
  diagram: DiagramDefinition,
  conditionKey?: string | null,
): PartConditionPreset | undefined {
  if (!conditionKey) return undefined;
  return diagram.conditionPresets.find((preset) => preset.key === conditionKey);
}

export function createEmptyBodyChartData(
  diagramKey: DiagramKey,
): BodyChartData {
  const diagram = getDiagramDefinition(diagramKey);
  return {
    schemaVersion: 1,
    diagramKey,
    activeViewId: diagram.views?.[0]?.id,
    numberingMode: diagram.numberingModes?.[0]?.id,
    animationsEnabled: diagram.ambientAnimation !== "none" || diagramKey === "cardiology",
    parts: {},
  };
}

export function extractPartHistory(
  snapshots: readonly PatientBodyChartRecord[],
  partId: string,
  diagramKey?: DiagramKey,
): PartHistoryEntry[] {
  const entries: PartHistoryEntry[] = [];
  for (const snap of snapshots) {
    if (diagramKey && snap.diagram_key !== diagramKey) continue;
    const annotation = snap.chart_data?.parts?.[partId];
    if (!annotation) continue;
    entries.push({
      chartId: snap.id,
      version: snap.version,
      createdAt: snap.created_at,
      doctorName: snap.doctor_name,
      annotation,
    });
  }
  return entries.sort((a, b) => b.version - a.version);
}
