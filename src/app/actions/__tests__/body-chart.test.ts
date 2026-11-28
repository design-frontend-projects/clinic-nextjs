import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireTenantInfo,
  mockHasPermission,
  mockRequireCurrentPatient,
  mockRevalidatePath,
  mockTx,
  mockPrisma,
} = vi.hoisted(() => {
  const tx = {
    patient_body_charts: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    audit_logs: {
      create: vi.fn(),
    },
  };
  return {
    mockRequireTenantInfo: vi.fn(),
    mockHasPermission: vi.fn(),
    mockRequireCurrentPatient: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockTx: tx,
    mockPrisma: {
      patients: { findFirst: vi.fn() },
      appointments: { findFirst: vi.fn() },
      encounters: { findFirst: vi.fn() },
      clinics: { findUnique: vi.fn() },
      doctor_specialties: { findMany: vi.fn() },
      specialties: { findMany: vi.fn() },
      patient_body_charts: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ requireTenantInfo: mockRequireTenantInfo }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mockHasPermission }));
vi.mock("@/lib/patient-auth", () => ({
  requireCurrentPatient: mockRequireCurrentPatient,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import {
  getMyBodyCharts,
  getPatientBodyCharts,
  savePatientBodyChart,
} from "../body-chart";
import { createEmptyBodyChartData } from "@/lib/body-chart/registry";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const DOCTOR_ID = "33333333-3333-4333-8333-333333333333";
const SPEC_ID = "44444444-4444-4444-8444-444444444444";
const APPT_ID = "66666666-6666-4666-8666-666666666666";
const ENCOUNTER_ID = "77777777-7777-4777-8777-777777777777";

describe("body-chart server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantInfo.mockResolvedValue({
      clinicId: CLINIC_ID,
      branchId: null,
      profileId: DOCTOR_ID,
      role: "doctor",
      fullName: "Dr. Dentist",
      email: "dentist@clinic.com",
      clinicName: "Smile Clinic",
      clinicSpecialtyId: SPEC_ID,
    });
  });

  it("blocks cross-tenant access when patient is not in caller clinic", async () => {
    mockPrisma.patients.findFirst.mockResolvedValue(null);
    await expect(getPatientBodyCharts(PATIENT_ID)).rejects.toThrow(
      "Patient not found",
    );
  });

  it("rejects non-practitioners trying to save a body chart", async () => {
    mockRequireTenantInfo.mockResolvedValue({
      clinicId: CLINIC_ID,
      profileId: DOCTOR_ID,
      role: "receptionist",
    });

    const chartData = createEmptyBodyChartData("dentistry");
    const res = await savePatientBodyChart({
      patientId: PATIENT_ID,
      appointmentId: APPT_ID,
      diagramKey: "dentistry",
      shareWithPatient: true,
      locale: "en",
      chartData,
    });
    expect("error" in res).toBe(true);
  });

  it("rejects saving a body chart without an appointmentId", async () => {
    const chartData = createEmptyBodyChartData("dentistry");
    const res = await savePatientBodyChart({
      patientId: PATIENT_ID,
      diagramKey: "dentistry",
      shareWithPatient: true,
      locale: "en",
      chartData,
    } as unknown as Parameters<typeof savePatientBodyChart>[0]);
    expect("error" in res).toBe(true);
  });

  it("rejects unknown anatomical part IDs for the selected diagram", async () => {
    mockPrisma.patients.findFirst.mockResolvedValue({
      id: PATIENT_ID,
      first_name: "Ali",
      last_name: "Hassan",
    });

    const chartData = createEmptyBodyChartData("dentistry");
    chartData.parts.non_existent_organ = {
      partId: "non_existent_organ",
      conditionKey: "caries",
      severity: "moderate",
      findings: "Invalid",
      treatmentPlan: "",
      updatedAt: new Date().toISOString(),
    };

    const res = await savePatientBodyChart({
      patientId: PATIENT_ID,
      appointmentId: APPT_ID,
      diagramKey: "dentistry",
      shareWithPatient: true,
      locale: "en",
      chartData,
    });
    expect("error" in res).toBe(true);
  });

  it("rejects standalone body chart saves for a completed appointment", async () => {
    mockPrisma.patients.findFirst.mockResolvedValue({
      id: PATIENT_ID,
      first_name: "Ali",
      last_name: "Hassan",
    });
    mockPrisma.appointments.findFirst.mockResolvedValue({
      id: APPT_ID,
      status: "completed",
      branch_id: null,
    });

    const res = await savePatientBodyChart({
      patientId: PATIENT_ID,
      appointmentId: APPT_ID,
      diagramKey: "dentistry",
      shareWithPatient: true,
      locale: "en",
      chartData: createEmptyBodyChartData("dentistry"),
    });
    expect(res).toEqual({
      error: "Cannot edit body chart for a completed appointment",
    });
  });

  it("allows attaching a body chart to a newly saved encounter on a completed appointment once", async () => {
    mockPrisma.patients.findFirst.mockResolvedValue({
      id: PATIENT_ID,
      first_name: "Ali",
      last_name: "Hassan",
    });
    mockPrisma.appointments.findFirst.mockResolvedValue({
      id: APPT_ID,
      status: "completed",
      branch_id: null,
    });
    mockPrisma.encounters.findFirst.mockResolvedValue({ id: ENCOUNTER_ID });
    mockPrisma.patient_body_charts.findFirst.mockResolvedValue(null);
    mockTx.patient_body_charts.findFirst.mockResolvedValue({ version: 1 });
    mockTx.patient_body_charts.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "55555555-5555-4555-8555-555555555555",
        ...data,
        created_at: new Date("2026-11-27T12:00:00Z"),
        updated_at: new Date("2026-11-27T12:00:00Z"),
        profiles: { full_name: "Dr. Dentist" },
        specialties: { name: "Dentistry", name_ar: "الأسنان" },
      }),
    );

    const res = await savePatientBodyChart({
      patientId: PATIENT_ID,
      appointmentId: APPT_ID,
      encounterId: ENCOUNTER_ID,
      diagramKey: "dentistry",
      shareWithPatient: true,
      locale: "en",
      chartData: createEmptyBodyChartData("dentistry"),
    });
    expect("success" in res && res.success).toBe(true);
  });

  it("rejects attaching another body chart when an encounter already has one", async () => {
    mockPrisma.patients.findFirst.mockResolvedValue({
      id: PATIENT_ID,
      first_name: "Ali",
      last_name: "Hassan",
    });
    mockPrisma.appointments.findFirst.mockResolvedValue({
      id: APPT_ID,
      status: "completed",
      branch_id: null,
    });
    mockPrisma.encounters.findFirst.mockResolvedValue({ id: ENCOUNTER_ID });
    mockPrisma.patient_body_charts.findFirst.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
    });

    const res = await savePatientBodyChart({
      patientId: PATIENT_ID,
      appointmentId: APPT_ID,
      encounterId: ENCOUNTER_ID,
      diagramKey: "dentistry",
      shareWithPatient: true,
      locale: "en",
      chartData: createEmptyBodyChartData("dentistry"),
    });
    expect(res).toEqual({
      error: "A body chart is already attached to this encounter",
    });
  });

  it("increments version sequentially and persists server-rendered animated SVG", async () => {
    mockPrisma.patients.findFirst.mockResolvedValue({
      id: PATIENT_ID,
      first_name: "Ali",
      last_name: "Hassan",
    });
    mockPrisma.appointments.findFirst.mockResolvedValue({
      id: APPT_ID,
      status: "scheduled",
      branch_id: null,
    });
    mockTx.patient_body_charts.findFirst.mockResolvedValue({ version: 1 });
    mockTx.patient_body_charts.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "55555555-5555-4555-8555-555555555555",
        ...data,
        created_at: new Date("2026-11-27T12:00:00Z"),
        updated_at: new Date("2026-11-27T12:00:00Z"),
        profiles: { full_name: "Dr. Dentist" },
        specialties: { name: "Dentistry", name_ar: "الأسنان" },
      }),
    );

    const chartData = createEmptyBodyChartData("dentistry");
    chartData.parts.tooth_11 = {
      partId: "tooth_11",
      conditionKey: "caries",
      severity: "moderate",
      findings: "Mesial caries lesion",
      treatmentPlan: "Composite filling",
      surfaces: ["M"],
      updatedAt: new Date().toISOString(),
    };

    const res = await savePatientBodyChart({
      patientId: PATIENT_ID,
      appointmentId: APPT_ID,
      diagramKey: "dentistry",
      specialtyId: SPEC_ID,
      shareWithPatient: true,
      locale: "en",
      chartData,
    });

    expect("success" in res && res.success).toBe(true);
    if ("success" in res) {
      expect(res.chart.version).toBe(2);
      expect(res.chart.animated_svg).toContain("<svg");
      expect(res.chart.animated_svg).toContain("@keyframes");
    }
    expect(mockTx.audit_logs.create).toHaveBeenCalledTimes(1);
  });

  it("getMyBodyCharts filters strictly to share_with_patient = true for the current patient", async () => {
    mockRequireCurrentPatient.mockResolvedValue({
      tenant: { clinicId: CLINIC_ID },
      patient: { id: PATIENT_ID, first_name: "Sara", last_name: "Noor" },
    });
    mockPrisma.patient_body_charts.findMany.mockResolvedValue([]);

    const res = await getMyBodyCharts();
    expect(res.patientName).toBe("Sara Noor");
    expect(mockPrisma.patient_body_charts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clinic_id: CLINIC_ID,
          patient_id: PATIENT_ID,
          share_with_patient: true,
        },
      }),
    );
  });
});
