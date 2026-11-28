import { z } from "zod";

export const DIAGRAM_KEYS = [
  "dentistry",
  "cardiology",
  "general_practice",
  "internal_medicine",
  "dermatology",
  "pediatrics",
  "orthopedics",
  "neurology",
  "ent",
  "ophthalmology",
  "gynecology",
  "psychiatry",
  "urology",
  "gastroenterology",
  "endocrinology",
  "general_body",
] as const;

export type DiagramKey = (typeof DIAGRAM_KEYS)[number];
export const diagramKeyEnum = z.enum(DIAGRAM_KEYS);

export const SEVERITY_LEVELS = [
  "low",
  "moderate",
  "severe",
  "critical",
] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const TOOTH_SURFACES = ["O", "M", "D", "B", "L"] as const;
export type ToothSurface = (typeof TOOTH_SURFACES)[number];

export const NUMBERING_MODES = ["fdi", "universal", "sequential"] as const;
export type NumberingMode = (typeof NUMBERING_MODES)[number];

export type VisualEffect =
  | "solid"
  | "pulse"
  | "flow"
  | "hatch"
  | "ring"
  | "missing";

export type AmbientAnimation =
  | "heartbeat"
  | "vascular_flow"
  | "breathing"
  | "neural_pulse"
  | "none";

export interface PartConditionPreset {
  key: string;
  labelEn: string;
  labelAr: string;
  fillHex: string;
  strokeHex: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  visualEffect?: VisualEffect;
}

export interface AnatomicalPoint {
  x: number;
  y: number;
}

export interface AnatomicalPartDefinition {
  id: string;
  orderNumber: number;
  code?: string;
  altCode?: string;
  labelEn: string;
  labelAr: string;
  layerId?: string;
  viewId?: string;
  groupEn?: string;
  groupAr?: string;
  paths: string[];
  labelAnchor: AnatomicalPoint;
  badgeAnchor?: AnatomicalPoint;
  flowPath?: string;
  flowTone?: "arterial" | "venous" | "neural";
  supportsSurfaces?: boolean;
}

export interface DiagramViewOption {
  id: string;
  labelEn: string;
  labelAr: string;
}

export interface DiagramLayerOption {
  id: string;
  labelEn: string;
  labelAr: string;
  defaultVisible: boolean;
}

export interface DiagramNumberingOption {
  id: NumberingMode;
  labelEn: string;
  labelAr: string;
}

export interface DiagramBackdropPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  viewId?: string;
  layerId?: string;
  className?: string;
}

export interface DiagramDefinition {
  key: DiagramKey;
  nameEn: string;
  nameAr: string;
  subtitleEn: string;
  subtitleAr: string;
  viewBox: string;
  views?: DiagramViewOption[];
  layers?: DiagramLayerOption[];
  numberingModes?: DiagramNumberingOption[];
  ambientAnimation?: AmbientAnimation;
  decorativeBackdropPaths: DiagramBackdropPath[];
  conditionPresets: PartConditionPreset[];
  parts: AnatomicalPartDefinition[];
}

export const partAnnotationSchema = z.object({
  partId: z.string().min(1),
  conditionKey: z.string().min(1),
  severity: z.enum(SEVERITY_LEVELS).default("moderate"),
  findings: z.string().trim().max(4000).default(""),
  treatmentPlan: z.string().trim().max(4000).default(""),
  surfaces: z.array(z.enum(TOOTH_SURFACES)).optional(),
  updatedAt: z.string(),
  updatedById: z.string().uuid().optional().nullable(),
  updatedByName: z.string().optional().nullable(),
});

export type PartAnnotation = z.infer<typeof partAnnotationSchema>;

export const bodyChartDataSchema = z.object({
  schemaVersion: z.literal(1),
  diagramKey: diagramKeyEnum,
  activeViewId: z.string().optional(),
  numberingMode: z.enum(NUMBERING_MODES).optional(),
  animationsEnabled: z.boolean().default(true),
  parts: z.record(z.string(), partAnnotationSchema),
});

export type BodyChartData = z.infer<typeof bodyChartDataSchema>;

export const savePatientBodyChartSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  diagramKey: diagramKeyEnum,
  specialtyId: z.string().uuid().optional().nullable(),
  encounterId: z.string().uuid().optional().nullable(),
  appointmentId: z.string().uuid("Active appointment is required"),
  title: z.string().trim().max(255).optional().nullable(),
  overallNotes: z.string().trim().max(6000).optional().nullable(),
  shareWithPatient: z.boolean().default(true),
  locale: z.enum(["en", "ar"]).default("en"),
  chartData: bodyChartDataSchema,
});

export type SavePatientBodyChartInput = z.infer<
  typeof savePatientBodyChartSchema
>;

export interface SpecialtyOption {
  id: string;
  name: string;
  name_ar: string | null;
  diagram_key: DiagramKey;
}

export interface PatientBodyChartRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  specialty_id: string | null;
  diagram_key: DiagramKey;
  encounter_id: string | null;
  appointment_id: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  specialty_name: string | null;
  specialty_name_ar: string | null;
  version: number;
  title: string | null;
  overall_notes: string | null;
  chart_data: BodyChartData;
  animated_svg: string;
  share_with_patient: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientBodyChartContext {
  patientId: string;
  patientName: string;
  clinicSpecialty: SpecialtyOption | null;
  doctorSpecialties: SpecialtyOption[];
  allSpecialties: SpecialtyOption[];
  defaultDiagramKey: DiagramKey;
  snapshots: PatientBodyChartRecord[];
  latestByDiagram: Partial<Record<DiagramKey, PatientBodyChartRecord>>;
  canEdit: boolean;
}

export interface PartHistoryEntry {
  chartId: string;
  version: number;
  createdAt: string;
  doctorName: string | null;
  annotation: PartAnnotation;
}
