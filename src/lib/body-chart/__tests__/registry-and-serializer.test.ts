import { describe, expect, it } from "vitest";
import {
  DIAGRAM_REGISTRY,
  createEmptyBodyChartData,
  extractPartHistory,
  getDiagramDefinition,
  getPartDisplayNumber,
  resolveDiagramKeyForSpecialty,
} from "../registry";
import { renderAnimatedSvg } from "../svg-serializer";
import type { PatientBodyChartRecord } from "@/types/body-chart.types";

const SEEDED_SPECIALTIES = [
  { name: "General Practice", diagram_key: "general_practice" },
  { name: "Internal Medicine", diagram_key: "internal_medicine" },
  { name: "Cardiology", diagram_key: "cardiology" },
  { name: "Dermatology", diagram_key: "dermatology" },
  { name: "Pediatrics", diagram_key: "pediatrics" },
  { name: "Orthopedics", diagram_key: "orthopedics" },
  { name: "Neurology", diagram_key: "neurology" },
  { name: "ENT", diagram_key: "ent" },
  { name: "Ophthalmology", diagram_key: "ophthalmology" },
  { name: "Gynecology", diagram_key: "gynecology" },
  { name: "Psychiatry", diagram_key: "psychiatry" },
  { name: "Dentistry", diagram_key: "dentistry" },
  { name: "Urology", diagram_key: "urology" },
  { name: "Gastroenterology", diagram_key: "gastroenterology" },
  { name: "Endocrinology", diagram_key: "endocrinology" },
];

describe("body-chart registry", () => {
  it("resolves all 15 seeded specialties to dedicated non-fallback diagram keys", () => {
    const resolved = new Set<string>();
    for (const s of SEEDED_SPECIALTIES) {
      const key = resolveDiagramKeyForSpecialty({ name: s.name, diagram_key: "general_body" });
      expect(key).toBe(s.diagram_key);
      expect(key).not.toBe("general_body");
      resolved.add(key);
    }
    expect(resolved.size).toBe(15);
  });

  it("falls back to general_body for unknown custom specialties", () => {
    expect(resolveDiagramKeyForSpecialty({ name: "Sleep Medicine" })).toBe("general_body");
    expect(resolveDiagramKeyForSpecialty(null)).toBe("general_body");
    expect(getDiagramDefinition("unknown_key").key).toBe("general_body");
  });

  it("validates every diagram has unique part IDs, sequential numbers, bilingual labels, and valid SVG paths", () => {
    for (const [key, diagram] of Object.entries(DIAGRAM_REGISTRY)) {
      expect(diagram.key).toBe(key);
      expect(diagram.nameEn.length).toBeGreaterThan(0);
      expect(diagram.nameAr.length).toBeGreaterThan(0);
      expect(diagram.parts.length).toBeGreaterThanOrEqual(8);
      expect(diagram.conditionPresets.length).toBeGreaterThanOrEqual(4);

      const seenIds = new Set<string>();
      for (const part of diagram.parts) {
        expect(seenIds.has(part.id)).toBe(false);
        seenIds.add(part.id);
        expect(part.orderNumber).toBeGreaterThan(0);
        expect(part.labelEn.length).toBeGreaterThan(0);
        expect(part.labelAr.length).toBeGreaterThan(0);
        expect(part.paths.length).toBeGreaterThan(0);
      }
    }
  });

  it("defines 32 adult + 20 pediatric teeth and jaw/TMJ parts in Dentistry with FDI and Universal numbering", () => {
    const dentistry = getDiagramDefinition("dentistry");
    const adultTeeth = dentistry.parts.filter((p) => p.viewId === "adult");
    const pediatricTeeth = dentistry.parts.filter((p) => p.viewId === "pediatric");
    expect(adultTeeth).toHaveLength(32);
    expect(pediatricTeeth).toHaveLength(20);
    const tooth11 = adultTeeth.find((p) => p.id === "tooth_11");
    expect(tooth11).toBeDefined();
    expect(getPartDisplayNumber(tooth11!, "fdi")).toBe("11");
    expect(getPartDisplayNumber(tooth11!, "universal")).toBe("8");
  });

  it("defines 20 sequentially ordered chambers, valves, great vessels, coronary arteries and cardiac veins in Cardiology", () => {
    const cardio = getDiagramDefinition("cardiology");
    expect(cardio.parts).toHaveLength(20);
    expect(cardio.parts.map((p) => p.orderNumber)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(cardio.parts.some((p) => p.id === "great_cardiac_vein")).toBe(true);
    expect(cardio.parts.some((p) => p.id === "coronary_sinus")).toBe(true);
    expect(cardio.parts.some((p) => p.id === "left_ventricle")).toBe(true);
  });

  it("extracts chronological per-part history across snapshots", () => {
    const baseData = createEmptyBodyChartData("cardiology");
    const snapshots = [
      {
        id: "c1",
        clinic_id: "cl1",
        patient_id: "p1",
        specialty_id: null,
        diagram_key: "cardiology",
        encounter_id: null,
        appointment_id: null,
        doctor_id: "d1",
        doctor_name: "Dr. A",
        specialty_name: "Cardiology",
        specialty_name_ar: null,
        version: 1,
        title: null,
        overall_notes: null,
        chart_data: {
          ...baseData,
          parts: {
            coronary_lad: {
              partId: "coronary_lad",
              conditionKey: "stenosis",
              severity: "moderate",
              findings: "60% proximal stenosis",
              treatmentPlan: "Medical therapy",
              updatedAt: "2026-01-01T10:00:00Z",
            },
          },
        },
        animated_svg: "<svg/>",
        share_with_patient: true,
        created_at: "2026-01-01T10:00:00Z",
        updated_at: "2026-01-01T10:00:00Z",
      },
      {
        id: "c2",
        clinic_id: "cl1",
        patient_id: "p1",
        specialty_id: null,
        diagram_key: "cardiology",
        encounter_id: null,
        appointment_id: null,
        doctor_id: "d1",
        doctor_name: "Dr. A",
        specialty_name: "Cardiology",
        specialty_name_ar: null,
        version: 2,
        title: null,
        overall_notes: null,
        chart_data: {
          ...baseData,
          parts: {
            coronary_lad: {
              partId: "coronary_lad",
              conditionKey: "stented",
              severity: "low",
              findings: "DES placed, TIMI 3 flow",
              treatmentPlan: "DAPT 12 months",
              updatedAt: "2026-02-01T10:00:00Z",
            },
          },
        },
        animated_svg: "<svg/>",
        share_with_patient: true,
        created_at: "2026-02-01T10:00:00Z",
        updated_at: "2026-02-01T10:00:00Z",
      },
    ] satisfies PatientBodyChartRecord[];

    const history = extractPartHistory(snapshots, "coronary_lad", "cardiology");
    expect(history).toHaveLength(2);
    expect(history[0].version).toBe(2);
    expect(history[1].version).toBe(1);
  });
});

describe("renderAnimatedSvg", () => {
  it("produces self-contained animated SVG with @keyframes and XML-escapes unsafe strings", () => {
    const diagram = getDiagramDefinition("cardiology");
    const chartData = createEmptyBodyChartData("cardiology");
    chartData.parts.coronary_lad = {
      partId: "coronary_lad",
      conditionKey: "stenosis",
      severity: "severe",
      findings: `<script>alert("xss")</script> & narrowing`,
      treatmentPlan: "PCI",
      updatedAt: "2026-11-27T12:00:00Z",
    };

    const svg = renderAnimatedSvg({
      diagram,
      chartData,
      locale: "en",
      meta: {
        patientName: `Jane <Doe> & "Co"`,
        doctorName: "Dr. Heart",
        version: 3,
        recordedAt: "2026-11-27T12:00:00Z",
      },
    });

    expect(svg).toContain("<svg xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("@keyframes bc-heartbeat");
    expect(svg).toContain("@keyframes bc-flow");
    expect(svg).toContain("#f59e0b");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; narrowing");
  });
});
