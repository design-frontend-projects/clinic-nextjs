"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { requireCurrentPatient } from "@/lib/patient-auth";
import { DOCTOR_PAGE_ROLES } from "@/types/clinic.types";
import {
  bodyChartDataSchema,
  savePatientBodyChartSchema,
  type BodyChartData,
  type DiagramKey,
  type PatientBodyChartContext,
  type PatientBodyChartRecord,
  type SavePatientBodyChartInput,
  type SpecialtyOption,
} from "@/types/body-chart.types";
import {
  createEmptyBodyChartData,
  getDiagramDefinition,
  isDiagramKey,
  resolveDiagramKeyForSpecialty,
} from "@/lib/body-chart/registry";
import { renderAnimatedSvg } from "@/lib/body-chart/svg-serializer";

function isPractitioner(role: string): boolean {
  return (DOCTOR_PAGE_ROLES as readonly string[]).includes(role);
}

function normalizeChartData(
  raw: unknown,
  diagramKey: DiagramKey,
): BodyChartData {
  const parsed = bodyChartDataSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return createEmptyBodyChartData(diagramKey);
}

function serializeSnapshotRow(row: {
  id: string;
  clinic_id: string;
  patient_id: string;
  specialty_id: string | null;
  diagram_key: string;
  encounter_id: string | null;
  appointment_id: string | null;
  doctor_id: string | null;
  version: number;
  title: string | null;
  overall_notes: string | null;
  chart_data: unknown;
  animated_svg: string;
  share_with_patient: boolean;
  created_at: Date;
  updated_at: Date;
  profiles?: { full_name: string | null } | null;
  specialties?: { name: string; name_ar: string | null } | null;
}): PatientBodyChartRecord {
  const key: DiagramKey = isDiagramKey(row.diagram_key)
    ? row.diagram_key
    : "general_body";
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    specialty_id: row.specialty_id,
    diagram_key: key,
    encounter_id: row.encounter_id,
    appointment_id: row.appointment_id,
    doctor_id: row.doctor_id,
    doctor_name: row.profiles?.full_name ?? null,
    specialty_name: row.specialties?.name ?? null,
    specialty_name_ar: row.specialties?.name_ar ?? null,
    version: row.version,
    title: row.title,
    overall_notes: row.overall_notes,
    chart_data: normalizeChartData(row.chart_data, key),
    animated_svg: row.animated_svg,
    share_with_patient: row.share_with_patient,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function toSpecialtyOption(s: {
  id: string;
  name: string;
  name_ar: string | null;
  diagram_key?: string | null;
}): SpecialtyOption {
  return {
    id: s.id,
    name: s.name,
    name_ar: s.name_ar,
    diagram_key: resolveDiagramKeyForSpecialty(s),
  };
}

export async function getPatientBodyCharts(
  patientId: string,
  requestedDiagramKey?: string,
): Promise<PatientBodyChartContext> {
  const tenant = await requireTenantInfo();
  const practitioner = isPractitioner(tenant.role);
  if (!practitioner) {
    const canRead = await hasPermission("patient.read");
    if (!canRead) {
      throw new Error("Unauthorized");
    }
  }

  const patient = await prisma.patients.findFirst({
    where: { id: patientId, clinic_id: tenant.clinicId },
    select: { id: true, first_name: true, last_name: true },
  });
  if (!patient) {
    throw new Error("Patient not found");
  }

  const [clinic, doctorLinks, allSpecialtiesRows, snapshotRows] =
    await Promise.all([
      prisma.clinics.findUnique({
        where: { id: tenant.clinicId },
        select: {
          specialty: {
            select: {
              id: true,
              name: true,
              name_ar: true,
              diagram_key: true,
            },
          },
        },
      }),
      practitioner
        ? prisma.doctor_specialties.findMany({
            where: { profile_id: tenant.profileId },
            select: {
              specialties: {
                select: {
                  id: true,
                  name: true,
                  name_ar: true,
                  diagram_key: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      prisma.specialties.findMany({
        where: { is_active: true },
        select: { id: true, name: true, name_ar: true, diagram_key: true },
        orderBy: [{ display_order: "asc" }, { name: "asc" }],
      }),
      prisma.patient_body_charts.findMany({
        where: { clinic_id: tenant.clinicId, patient_id: patientId },
        include: {
          profiles: { select: { full_name: true } },
          specialties: { select: { name: true, name_ar: true } },
        },
        orderBy: [{ created_at: "desc" }, { version: "desc" }],
        take: 100,
      }),
    ]);

  const clinicSpecialty = clinic?.specialty
    ? toSpecialtyOption(clinic.specialty)
    : null;

  const doctorSpecialties = doctorLinks
    .map((l) => toSpecialtyOption(l.specialties))
    .filter(Boolean);

  const allSpecialties = allSpecialtiesRows.map(toSpecialtyOption);

  const snapshots = snapshotRows.map(serializeSnapshotRow);

  const latestByDiagram: Partial<Record<DiagramKey, PatientBodyChartRecord>> =
    {};
  for (const snap of snapshots) {
    if (!latestByDiagram[snap.diagram_key]) {
      latestByDiagram[snap.diagram_key] = snap;
    }
  }

  const defaultDiagramKey: DiagramKey =
    requestedDiagramKey && isDiagramKey(requestedDiagramKey)
      ? requestedDiagramKey
      : clinicSpecialty?.diagram_key ??
        doctorSpecialties[0]?.diagram_key ??
        snapshots[0]?.diagram_key ??
        "general_body";

  return {
    patientId: patient.id,
    patientName:
      `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() ||
      "Patient",
    clinicSpecialty,
    doctorSpecialties,
    allSpecialties,
    defaultDiagramKey,
    snapshots,
    latestByDiagram,
    canEdit: practitioner,
  };
}

export async function savePatientBodyChart(
  input: SavePatientBodyChartInput,
): Promise<{ success: true; chart: PatientBodyChartRecord } | { error: string }> {
  try {
    const tenant = await requireTenantInfo();
    if (!isPractitioner(tenant.role)) {
      return { error: "Unauthorized: only practitioners can save body charts" };
    }

    const parsed = savePatientBodyChartSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid body chart data",
      };
    }
    const data = parsed.data;

    const patient = await prisma.patients.findFirst({
      where: { id: data.patientId, clinic_id: tenant.clinicId },
      select: { id: true, first_name: true, last_name: true },
    });
    if (!patient) {
      return { error: "Patient not found" };
    }

    const diagram = getDiagramDefinition(data.diagramKey);
    const validPartIds = new Set(diagram.parts.map((p) => p.id));
    for (const partId of Object.keys(data.chartData.parts)) {
      if (!validPartIds.has(partId)) {
        return {
          error: `Invalid anatomical part "${partId}" for diagram "${data.diagramKey}"`,
        };
      }
    }

    const appointment = await prisma.appointments.findFirst({
      where: {
        id: data.appointmentId,
        clinic_id: tenant.clinicId,
        patient_id: data.patientId,
        doctor_id: tenant.profileId,
      },
      select: { id: true, status: true, branch_id: true },
    });
    if (!appointment) {
      return { error: "Active appointment not found" };
    }
    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      return { error: "Cannot save a body chart for a cancelled appointment" };
    }
    if (appointment.status === "completed") {
      if (!data.encounterId) {
        return { error: "Cannot edit body chart for a completed appointment" };
      }
      const linkedEncounter = await prisma.encounters.findFirst({
        where: {
          id: data.encounterId,
          clinic_id: tenant.clinicId,
          patient_id: data.patientId,
          doctor_id: tenant.profileId,
          appointment_id: appointment.id,
        },
        select: { id: true },
      });
      if (!linkedEncounter) {
        return { error: "Cannot attach body chart: linked encounter not found" };
      }
      const alreadyAttached = await prisma.patient_body_charts.findFirst({
        where: {
          clinic_id: tenant.clinicId,
          encounter_id: linkedEncounter.id,
        },
        select: { id: true },
      });
      if (alreadyAttached) {
        return { error: "A body chart is already attached to this encounter" };
      }
    }

    const patientName =
      `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() ||
      "Patient";

    const created = await prisma.$transaction(async (tx) => {
      const latest = await tx.patient_body_charts.findFirst({
        where: {
          clinic_id: tenant.clinicId,
          patient_id: data.patientId,
          diagram_key: data.diagramKey,
        },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const nextVersion = (latest?.version ?? 0) + 1;

      const normalizedChartData: BodyChartData = {
        ...data.chartData,
        diagramKey: data.diagramKey,
      };

      const animatedSvg = renderAnimatedSvg({
        diagram,
        chartData: normalizedChartData,
        locale: data.locale,
        meta: {
          patientName,
          doctorName: tenant.fullName,
          clinicName: tenant.clinicName,
          recordedAt: new Date().toISOString(),
          version: nextVersion,
        },
      });

      const row = await tx.patient_body_charts.create({
        data: {
          clinic_id: tenant.clinicId,
          branch_id: appointment.branch_id ?? tenant.branchId ?? null,
          patient_id: data.patientId,
          specialty_id: data.specialtyId ?? tenant.clinicSpecialtyId ?? null,
          diagram_key: data.diagramKey,
          encounter_id: data.encounterId ?? null,
          appointment_id: appointment.id,
          doctor_id: tenant.profileId,
          version: nextVersion,
          title: data.title || null,
          overall_notes: data.overallNotes || null,
          chart_data: normalizedChartData,
          animated_svg: animatedSvg,
          share_with_patient: data.shareWithPatient,
        },
        include: {
          profiles: { select: { full_name: true } },
          specialties: { select: { name: true, name_ar: true } },
        },
      });

      await tx.audit_logs.create({
        data: {
          tenant_id: tenant.clinicId,
          actor_id: tenant.profileId,
          actor_email: tenant.email,
          action: "BODY_CHART_SAVED",
          entity_type: "patient_body_charts",
          entity_id: row.id,
          new_values: {
            patient_id: data.patientId,
            diagram_key: data.diagramKey,
            version: nextVersion,
            marked_parts_count: Object.keys(normalizedChartData.parts).length,
          },
        },
      });

      return row;
    });

    revalidatePath(`/doctor/patients/${data.patientId}`);
    revalidatePath("/admin/patients");
    revalidatePath("/patient/reports");

    return { success: true, chart: serializeSnapshotRow(created) };
  } catch (error) {
    console.error("[body-chart] savePatientBodyChart failed:", error);
    return { error: "Failed to save body chart snapshot" };
  }
}

export async function toggleBodyChartSharing(
  chartId: string,
  shareWithPatient: boolean,
): Promise<{ success: true; share_with_patient: boolean } | { error: string }> {
  try {
    const tenant = await requireTenantInfo();
    if (!isPractitioner(tenant.role)) {
      return { error: "Unauthorized" };
    }

    const existing = await prisma.patient_body_charts.findFirst({
      where: { id: chartId, clinic_id: tenant.clinicId },
      select: { id: true, patient_id: true },
    });
    if (!existing) {
      return { error: "Body chart snapshot not found" };
    }

    await prisma.patient_body_charts.update({
      where: { id: existing.id },
      data: { share_with_patient: shareWithPatient },
    });

    revalidatePath(`/doctor/patients/${existing.patient_id}`);
    revalidatePath("/patient/reports");

    return { success: true, share_with_patient: shareWithPatient };
  } catch (error) {
    console.error("[body-chart] toggleBodyChartSharing failed:", error);
    return { error: "Failed to update sharing setting" };
  }
}

export async function deletePatientBodyChart(
  chartId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const tenant = await requireTenantInfo();
    if (!isPractitioner(tenant.role)) {
      return { error: "Unauthorized" };
    }

    const existing = await prisma.patient_body_charts.findFirst({
      where: { id: chartId, clinic_id: tenant.clinicId },
      select: { id: true, patient_id: true, diagram_key: true, version: true },
    });
    if (!existing) {
      return { error: "Body chart snapshot not found" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.patient_body_charts.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      await tx.audit_logs.create({
        data: {
          tenant_id: tenant.clinicId,
          actor_id: tenant.profileId,
          actor_email: tenant.email,
          action: "BODY_CHART_DELETED",
          entity_type: "patient_body_charts",
          entity_id: existing.id,
          old_values: {
            patient_id: existing.patient_id,
            diagram_key: existing.diagram_key,
            version: existing.version,
          },
        },
      });
    });

    revalidatePath(`/doctor/patients/${existing.patient_id}`);
    revalidatePath("/patient/reports");
    return { success: true };
  } catch (error) {
    console.error("[body-chart] deletePatientBodyChart failed:", error);
    return { error: "Failed to delete body chart snapshot" };
  }
}

export async function getMyBodyCharts(): Promise<{
  patientName: string;
  charts: PatientBodyChartRecord[];
}> {
  const { tenant, patient } = await requireCurrentPatient();

  const rows = await prisma.patient_body_charts.findMany({
    where: {
      clinic_id: tenant.clinicId,
      patient_id: patient.id,
      share_with_patient: true,
    },
    include: {
      profiles: { select: { full_name: true } },
      specialties: { select: { name: true, name_ar: true } },
    },
    orderBy: [{ created_at: "desc" }, { version: "desc" }],
    take: 50,
  });

  return {
    patientName:
      `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() ||
      "Patient",
    charts: rows.map(serializeSnapshotRow),
  };
}
