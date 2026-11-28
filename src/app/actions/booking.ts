"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { requireCurrentPatient } from "@/lib/patient-auth";
import {
  registerPatientWithAppointmentForScope,
  type RegisterPatientResult,
} from "@/lib/appointment-service";
import {
  SLOT_INTERVAL_MINUTES,
  TERMINAL_BOOKING_STATUSES,
  computeBookingCapabilities,
  normalizeDoctorAvailability,
  resolveBookingRoleScope,
  validateDoctorSlotAvailability,
} from "@/lib/booking-rules";
import {
  bookingCreateSchema,
  bookingFiltersSchema,
  bookingUpdateSchema,
  type BookingActionResult,
  type BookingBranchOption,
  type BookingCatalogItemOption,
  type BookingContextData,
  type BookingCreateInput,
  type BookingDetail,
  type BookingDoctorOption,
  type BookingFilters,
  type BookingItem,
  type BookingListStats,
  type BookingRoleScope,
  type BookingUpdateInput,
  type ProfileStatusValue,
} from "@/types/booking.types";
import type { BillingItemCategory } from "@/types/billing.types";
import type { CreateAppointmentWithPatientData } from "@/types/appointment.types";
import type { AppointmentStatus } from "@/types/staff.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function fullPatientName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const joined = `${first ?? ""} ${last ?? ""}`.trim();
  return joined || "Unknown patient";
}

function todayBounds(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function dayBounds(dateIso: string): { start: Date; end: Date } | null {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function revalidateBookingPaths(): void {
  revalidatePath("/booking");
  revalidatePath("/staff/booking");
  revalidatePath("/staff");
  revalidatePath("/staff/checkin");
  revalidatePath("/admin/appointments");
  revalidatePath("/doctor");
  revalidatePath("/doctor/appointments");
  revalidatePath("/patient");
  revalidatePath("/patient/appointments");
}

interface ResolvedBookingPermissions {
  roleScope: BookingRoleScope;
  canRead: boolean;
  canCreate: boolean;
  canCancel: boolean;
  patientId: string | null;
}

async function resolveBookingPermissions(
  tenant: Awaited<ReturnType<typeof requireTenantInfo>>,
): Promise<ResolvedBookingPermissions> {
  const roleScope = resolveBookingRoleScope(tenant.role);

  if (roleScope === "patient") {
    const { patient } = await requireCurrentPatient();
    return {
      roleScope,
      canRead: true,
      canCreate: true,
      canCancel: true,
      patientId: patient.id,
    };
  }

  if (roleScope === "admin" || roleScope === "doctor") {
    return {
      roleScope,
      canRead: true,
      canCreate: true,
      canCancel: true,
      patientId: null,
    };
  }

  const [canRead, canCreate, canCancel] = await Promise.all([
    hasPermission("appointment.read"),
    hasPermission("appointment.create"),
    hasPermission("appointment.cancel"),
  ]);

  return {
    roleScope,
    canRead,
    canCreate,
    canCancel,
    patientId: null,
  };
}

function buildRoleScopeWhere(
  tenant: Awaited<ReturnType<typeof requireTenantInfo>>,
  perms: ResolvedBookingPermissions,
  options?: { enforceActiveBranch?: boolean },
): Prisma.appointmentsWhereInput {
  const enforceBranch = options?.enforceActiveBranch ?? true;
  if (perms.roleScope === "patient") {
    return {
      clinic_id: tenant.clinicId,
      patient_id: perms.patientId ?? "",
    };
  }
  const branchFilter =
    tenant.branchId && (tenant.branchLocked || enforceBranch)
      ? { branch_id: tenant.branchId }
      : {};
  if (perms.roleScope === "doctor") {
    return {
      clinic_id: tenant.clinicId,
      doctor_id: tenant.profileId,
      ...branchFilter,
    };
  }
  return {
    clinic_id: tenant.clinicId,
    ...branchFilter,
  };
}

const BOOKING_ITEM_INCLUDE = {
  patients: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      phone: true,
      email: true,
    },
  },
  profiles: {
    select: {
      id: true,
      full_name: true,
      specialty: true,
      email: true,
    },
  },
  branches: {
    select: {
      id: true,
      name: true,
    },
  },
  billing_catalog_items: {
    select: {
      id: true,
      name_en: true,
      name_ar: true,
      category: true,
      price: true,
      description: true,
      is_active: true,
    },
  },
} satisfies Prisma.appointmentsInclude;

type BookingItemRow = Prisma.appointmentsGetPayload<{
  include: typeof BOOKING_ITEM_INCLUDE;
}>;

interface CatalogItemSelectableRow {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  price: unknown;
  description: string | null;
  is_active: boolean;
}

function mapCatalogItem(
  row: CatalogItemSelectableRow,
): BookingCatalogItemOption {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    category: row.category as BillingItemCategory,
    price: Number(row.price),
    description: row.description,
    isActive: row.is_active,
  };
}

async function validateActiveCatalogItem(
  clinicId: string,
  catalogItemId: string,
): Promise<boolean> {
  const item = await prisma.billing_catalog_items.findFirst({
    where: {
      id: catalogItemId,
      clinic_id: clinicId,
      is_active: true,
      deleted_at: null,
    },
    select: { id: true },
  });
  return Boolean(item);
}

function mapBookingItem(
  row: BookingItemRow,
  perms: ResolvedBookingPermissions,
  branchLocked: boolean,
): BookingItem {
  const status = row.status as AppointmentStatus;
  return {
    id: row.id,
    appointmentDate: row.appointment_date.toISOString(),
    status,
    notes: row.notes,
    checkedInAt: row.checked_in_at ? row.checked_in_at.toISOString() : null,
    patient: {
      id: row.patients.id,
      fullName: fullPatientName(row.patients.first_name, row.patients.last_name),
      phone: row.patients.phone,
      email: row.patients.email,
    },
    doctor: row.profiles
      ? {
          id: row.profiles.id,
          fullName: row.profiles.full_name || row.profiles.email || "Unassigned",
          specialty: row.profiles.specialty,
          email: row.profiles.email,
        }
      : null,
    branch: row.branches
      ? {
          id: row.branches.id,
          name: row.branches.name,
        }
      : null,
    catalogItem: row.billing_catalog_items
      ? mapCatalogItem(row.billing_catalog_items)
      : null,
    capabilities: computeBookingCapabilities({
      roleScope: perms.roleScope,
      status,
      appointmentDate: row.appointment_date,
      canCreatePermission: perms.canCreate,
      canCancelPermission: perms.canCancel,
      branchLocked,
    }),
  };
}

const BOOKING_DETAIL_INCLUDE = {
  ...BOOKING_ITEM_INCLUDE,
  review: { select: { id: true } },
  _count: {
    select: {
      encounters: true,
      lab_orders: true,
    },
  },
} satisfies Prisma.appointmentsInclude;

type BookingDetailRow = Prisma.appointmentsGetPayload<{
  include: typeof BOOKING_DETAIL_INCLUDE;
}>;

function mapBookingDetail(
  row: BookingDetailRow,
  perms: ResolvedBookingPermissions,
  branchLocked: boolean,
): BookingDetail {
  return {
    ...mapBookingItem(row, perms, branchLocked),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    encountersCount: row._count.encounters,
    labOrdersCount: row._count.lab_orders,
    hasReview: Boolean(row.review),
  };
}

async function hasActiveDoctorConflict(params: {
  clinicId: string;
  doctorId: string;
  targetDate: Date;
  slotDurationMinutes?: number;
  excludeBookingId?: string;
}): Promise<boolean> {
  const intervalMinutes = params.slotDurationMinutes ?? SLOT_INTERVAL_MINUTES;
  const windowMs = intervalMinutes * 60_000;
  const conflict = await prisma.appointments.findFirst({
    where: {
      clinic_id: params.clinicId,
      doctor_id: params.doctorId,
      status: { notIn: ["cancelled", "no_show"] },
      appointment_date: {
        gt: new Date(params.targetDate.getTime() - windowMs),
        lt: new Date(params.targetDate.getTime() + windowMs),
      },
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

/**
 * Resolve the current user's booking context: role scope, capabilities,
 * clinic doctors (including inactive status & schedule metadata), and branches.
 */
export async function getBookingContext(): Promise<BookingContextData> {
  const tenant = await requireTenantInfo();
  const perms = await resolveBookingPermissions(tenant);

  const [doctorRows, clinicBranches, catalogRows] = await Promise.all([
    prisma.profiles.findMany({
      where: {
        tenant_id: tenant.clinicId,
        OR: [{ role: { in: ["doctor", "owner"] } }, { is_owner: true }],
      },
      select: {
        id: true,
        full_name: true,
        specialty: true,
        email: true,
        status: true,
        branch_id: true,
        available_from: true,
        available_to: true,
        slot_duration_minutes: true,
        available_days: true,
        profile_branches: {
          where: { clinic_id: tenant.clinicId },
          select: { branch_id: true },
        },
      },
      orderBy: { full_name: "asc" },
    }),
    prisma.clinic_branches.findMany({
      where: { clinic_id: tenant.clinicId },
      include: {
        branches: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
    }),
    perms.roleScope !== "patient"
      ? prisma.billing_catalog_items.findMany({
          where: {
            clinic_id: tenant.clinicId,
            is_active: true,
            deleted_at: null,
          },
          select: {
            id: true,
            name_en: true,
            name_ar: true,
            category: true,
            price: true,
            description: true,
            is_active: true,
          },
          orderBy: [{ category: "asc" }, { name_en: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const doctors: BookingDoctorOption[] = doctorRows
    .map((d) => {
      const branchSet = new Set<string>();
      if (d.branch_id) branchSet.add(d.branch_id);
      for (const pb of d.profile_branches) {
        branchSet.add(pb.branch_id);
      }
      const availability = normalizeDoctorAvailability(d);
      return {
        id: d.id,
        fullName: d.full_name || d.email || "Doctor",
        specialty: d.specialty,
        email: d.email,
        status: (d.status || "active") as ProfileStatusValue,
        branchIds: Array.from(branchSet),
        availableFrom: availability.availableFrom,
        availableTo: availability.availableTo,
        slotDurationMinutes: availability.slotDurationMinutes,
        availableDays: availability.availableDays,
      };
    })
    .sort((a, b) => {
      const aActive = a.status === "active" ? 0 : 1;
      const bActive = b.status === "active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.fullName.localeCompare(b.fullName);
    });

  const branches: BookingBranchOption[] = clinicBranches
    .filter((cb) => cb.branches.status === "active")
    .map((cb) => ({
      id: cb.branches.id,
      name: cb.branches.name,
      isPrimary: cb.is_primary,
    }));

  return {
    clinicId: tenant.clinicId,
    clinicName: tenant.clinicName ?? "",
    profileId: tenant.profileId,
    roleScope: perms.roleScope,
    branchId: tenant.branchId,
    branchLocked: tenant.branchLocked,
    canCreate: perms.canCreate,
    canCancel: perms.canCancel,
    canCreateNewPatient: perms.roleScope !== "patient" && perms.canCreate,
    doctors,
    branches,
    catalogItems: catalogRows.map(mapCatalogItem),
  };
}

/**
 * Fetch role- and tenant-scoped bookings plus summary KPI counters.
 */
export async function getBookings(
  filters?: BookingFilters,
): Promise<{ items: BookingItem[]; stats: BookingListStats }> {
  const tenant = await requireTenantInfo();
  const perms = await resolveBookingPermissions(tenant);

  if (!perms.canRead) {
    throw new Error("Forbidden: Missing required permission (appointment.read)");
  }

  const parsedFilters = bookingFiltersSchema.safeParse(filters ?? {});
  const cleanFilters: BookingFilters = parsedFilters.success
    ? parsedFilters.data
    : {};

  const baseWhere = buildRoleScopeWhere(tenant, perms);
  const { start: todayStart, end: todayEnd } = todayBounds();
  const now = new Date();

  const range = cleanFilters.range ?? (perms.roleScope === "patient" ? "upcoming" : "today");
  let dateWhere: Prisma.DateTimeFilter | undefined;
  if (cleanFilters.date) {
    const bounds = dayBounds(cleanFilters.date);
    if (bounds) {
      dateWhere = { gte: bounds.start, lte: bounds.end };
    }
  } else if (range === "today") {
    dateWhere = { gte: todayStart, lte: todayEnd };
  } else if (range === "upcoming") {
    dateWhere = { gte: now };
  }

  const searchTerm = cleanFilters.search?.trim();
  const filteredWhere: Prisma.appointmentsWhereInput = {
    ...baseWhere,
    ...(cleanFilters.status && cleanFilters.status !== "all"
      ? { status: cleanFilters.status as AppointmentStatus }
      : {}),
    ...(perms.roleScope !== "doctor" &&
    cleanFilters.doctorId &&
    cleanFilters.doctorId !== "all" &&
    isValidUuid(cleanFilters.doctorId)
      ? { doctor_id: cleanFilters.doctorId }
      : {}),
    ...(dateWhere ? { appointment_date: dateWhere } : {}),
    ...(searchTerm
      ? {
          OR: [
            { notes: { contains: searchTerm, mode: "insensitive" } },
            {
              patients: {
                OR: [
                  { first_name: { contains: searchTerm, mode: "insensitive" } },
                  { last_name: { contains: searchTerm, mode: "insensitive" } },
                  { phone: { contains: searchTerm, mode: "insensitive" } },
                ],
              },
            },
            {
              profiles: {
                full_name: { contains: searchTerm, mode: "insensitive" },
              },
            },
            {
              billing_catalog_items: {
                OR: [
                  { name_en: { contains: searchTerm, mode: "insensitive" } },
                  { name_ar: { contains: searchTerm, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const orderDir = cleanFilters.date || range !== "all" ? "asc" : "desc";

  const [
    rows,
    todayCount,
    upcomingCount,
    statusGroups,
  ] = await Promise.all([
    prisma.appointments.findMany({
      where: filteredWhere,
      include: BOOKING_ITEM_INCLUDE,
      orderBy: { appointment_date: orderDir },
      take: 150,
    }),
    prisma.appointments.count({
      where: {
        ...baseWhere,
        appointment_date: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.appointments.count({
      where: {
        ...baseWhere,
        appointment_date: { gte: now },
        status: { notIn: ["cancelled", "no_show"] },
      },
    }),
    prisma.appointments.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const countsByStatus = new Map<AppointmentStatus, number>(
    statusGroups.map((g) => [g.status as AppointmentStatus, g._count._all]),
  );

  let totalCount = 0;
  for (const g of statusGroups) {
    totalCount += g._count._all;
  }

  return {
    items: rows.map((row) => mapBookingItem(row, perms, tenant.branchLocked)),
    stats: {
      todayCount,
      upcomingCount,
      scheduledCount: countsByStatus.get("scheduled") ?? 0,
      checkedInCount: countsByStatus.get("checked_in") ?? 0,
      completedCount: countsByStatus.get("completed") ?? 0,
      cancelledCount: countsByStatus.get("cancelled") ?? 0,
      totalCount,
    },
  };
}

/**
 * Fetch detailed view of a single booking, scoped strictly to tenant and role.
 */
export async function getBookingById(id: string): Promise<BookingDetail | null> {
  if (!isValidUuid(id)) return null;

  const tenant = await requireTenantInfo();
  const perms = await resolveBookingPermissions(tenant);

  if (!perms.canRead) {
    throw new Error("Forbidden: Missing required permission (appointment.read)");
  }

  const row = await prisma.appointments.findFirst({
    where: {
      id,
      ...buildRoleScopeWhere(tenant, perms, { enforceActiveBranch: false }),
    },
    include: BOOKING_DETAIL_INCLUDE,
  });

  if (!row) return null;
  return mapBookingDetail(row, perms, tenant.branchLocked);
}

/**
 * Return active appointment timestamps for a doctor on a given calendar day so
 * the slot picker can mark occupied 30-minute intervals without exposing PII.
 */
export async function getDoctorBookedSlots(
  doctorId: string,
  dateIso: string,
  excludeBookingId?: string,
): Promise<string[]> {
  if (!isValidUuid(doctorId)) return [];
  const bounds = dayBounds(dateIso);
  if (!bounds) return [];

  const tenant = await requireTenantInfo();

  const rows = await prisma.appointments.findMany({
    where: {
      clinic_id: tenant.clinicId,
      doctor_id: doctorId,
      appointment_date: { gte: bounds.start, lte: bounds.end },
      status: { notIn: ["cancelled", "no_show"] },
      ...(excludeBookingId && isValidUuid(excludeBookingId)
        ? { id: { not: excludeBookingId } }
        : {}),
    },
    select: { appointment_date: true },
    orderBy: { appointment_date: "asc" },
  });

  return rows.map((r) => r.appointment_date.toISOString());
}

/**
 * Search clinic patients for booking creation (non-patient roles only).
 */
export async function searchBookingPatients(query: string) {
  const tenant = await requireTenantInfo();
  const perms = await resolveBookingPermissions(tenant);

  if (perms.roleScope === "patient" || !perms.canCreate) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.patients.findMany({
    where: {
      clinic_id: tenant.clinicId,
      OR: [
        { first_name: { contains: trimmed, mode: "insensitive" } },
        { last_name: { contains: trimmed, mode: "insensitive" } },
        { phone: { contains: trimmed, mode: "insensitive" } },
        { email: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
    },
    take: 10,
  });
}

/**
 * Create a new booking with role scoping, tenant verification, and 30-minute
 * doctor conflict prevention.
 */
export async function createBooking(
  input: BookingCreateInput,
): Promise<BookingActionResult<BookingItem>> {
  try {
    const tenant = await requireTenantInfo();
    const perms = await resolveBookingPermissions(tenant);

    if (!perms.canCreate) {
      return { error: "You do not have permission to create bookings." };
    }

    const parsed = bookingCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid booking data" };
    }

    const appointmentDate = new Date(parsed.data.appointment_date);
    if (Number.isNaN(appointmentDate.getTime())) {
      return { error: "Invalid appointment date and time." };
    }

    if (perms.roleScope === "patient" && appointmentDate.getTime() <= Date.now()) {
      return { error: "Cannot book an appointment in the past." };
    }

    let targetPatientId = perms.patientId;
    if (perms.roleScope !== "patient") {
      if (!parsed.data.patient_id) {
        return { error: "Please select a patient." };
      }
      const patientRecord = await prisma.patients.findFirst({
        where: { id: parsed.data.patient_id, clinic_id: tenant.clinicId },
        select: { id: true },
      });
      if (!patientRecord) {
        return { error: "Selected patient was not found in this clinic." };
      }
      targetPatientId = patientRecord.id;
    }

    if (!targetPatientId) {
      return { error: "No patient record linked to this booking." };
    }

    const targetDoctorId =
      perms.roleScope === "doctor" ? tenant.profileId : parsed.data.doctor_id;

    const doctorRecord = await prisma.profiles.findFirst({
      where: {
        id: targetDoctorId,
        tenant_id: tenant.clinicId,
        OR: [{ role: { in: ["doctor", "owner"] } }, { is_owner: true }],
      },
      select: {
        id: true,
        status: true,
        available_from: true,
        available_to: true,
        slot_duration_minutes: true,
        available_days: true,
      },
    });
    if (!doctorRecord) {
      return { error: "Selected doctor was not found in this clinic." };
    }

    const availability = normalizeDoctorAvailability(doctorRecord);
    const slotCheck = validateDoctorSlotAvailability(availability, appointmentDate);
    if (!slotCheck.valid) {
      return { error: slotCheck.message };
    }

    let resolvedBranchId: string | null = tenant.branchId;
    if (!tenant.branchLocked && parsed.data.branch_id !== undefined) {
      if (parsed.data.branch_id) {
        const linkedBranch = await prisma.clinic_branches.findFirst({
          where: {
            clinic_id: tenant.clinicId,
            branch_id: parsed.data.branch_id,
          },
          select: { branch_id: true },
        });
        if (!linkedBranch) {
          return { error: "Selected branch does not belong to this clinic." };
        }
        resolvedBranchId = linkedBranch.branch_id;
      } else {
        resolvedBranchId = null;
      }
    }

    let resolvedCatalogItemId: string | null = null;
    if (perms.roleScope !== "patient" && parsed.data.catalog_item_id) {
      const isCatalogValid = await validateActiveCatalogItem(
        tenant.clinicId,
        parsed.data.catalog_item_id,
      );
      if (!isCatalogValid) {
        return {
          error:
            "Selected service item is unavailable or not found in this clinic.",
        };
      }
      resolvedCatalogItemId = parsed.data.catalog_item_id;
    }

    const conflict = await hasActiveDoctorConflict({
      clinicId: tenant.clinicId,
      doctorId: targetDoctorId,
      targetDate: appointmentDate,
      slotDurationMinutes: availability.slotDurationMinutes,
    });
    if (conflict) {
      return {
        error: `This doctor already has an appointment within ${availability.slotDurationMinutes} minutes of the selected time. Please choose another slot.`,
      };
    }

    const created = await prisma.appointments.create({
      data: {
        clinic_id: tenant.clinicId,
        branch_id: resolvedBranchId,
        patient_id: targetPatientId,
        doctor_id: targetDoctorId,
        catalog_item_id: resolvedCatalogItemId,
        appointment_date: appointmentDate,
        notes: parsed.data.notes?.trim() || null,
        status: "scheduled",
      },
      include: BOOKING_ITEM_INCLUDE,
    });

    revalidateBookingPaths();
    return {
      success: true,
      data: mapBookingItem(created, perms, tenant.branchLocked),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create booking.",
    };
  }
}

/**
 * Register a brand-new patient and create their booking in one transaction
 * (clinic roles only, with 30-minute conflict check).
 */
export async function registerPatientAndCreateBooking(
  data: CreateAppointmentWithPatientData,
): Promise<RegisterPatientResult> {
  try {
    const tenant = await requireTenantInfo();
    const perms = await resolveBookingPermissions(tenant);

    if (perms.roleScope === "patient" || !perms.canCreate) {
      return { error: "You do not have permission to register patients and book." };
    }

    const doctorId =
      perms.roleScope === "doctor" ? tenant.profileId : data.appointment.doctor_id;
    const appointmentDate = new Date(data.appointment.appointment_date);
    if (Number.isNaN(appointmentDate.getTime())) {
      return { error: "Invalid appointment date and time." };
    }

    const doctorRecord = await prisma.profiles.findFirst({
      where: {
        id: doctorId,
        tenant_id: tenant.clinicId,
        OR: [{ role: { in: ["doctor", "owner"] } }, { is_owner: true }],
      },
      select: {
        id: true,
        status: true,
        available_from: true,
        available_to: true,
        slot_duration_minutes: true,
        available_days: true,
      },
    });
    if (!doctorRecord) {
      return { error: "Selected doctor was not found in this clinic." };
    }

    const availability = normalizeDoctorAvailability(doctorRecord);
    const slotCheck = validateDoctorSlotAvailability(availability, appointmentDate);
    if (!slotCheck.valid) {
      return { error: slotCheck.message };
    }

    if (data.appointment.catalog_item_id) {
      const isCatalogValid = await validateActiveCatalogItem(
        tenant.clinicId,
        data.appointment.catalog_item_id,
      );
      if (!isCatalogValid) {
        return {
          error:
            "Selected service item is unavailable or not found in this clinic.",
        };
      }
    }

    const conflict = await hasActiveDoctorConflict({
      clinicId: tenant.clinicId,
      doctorId,
      targetDate: appointmentDate,
      slotDurationMinutes: availability.slotDurationMinutes,
    });
    if (conflict) {
      return {
        error: `This doctor already has an appointment within ${availability.slotDurationMinutes} minutes of the selected time. Please choose another slot.`,
      };
    }

    const scopedPayload: CreateAppointmentWithPatientData = {
      ...data,
      appointment: {
        ...data.appointment,
        doctor_id: doctorId,
      },
    };

    const result = await registerPatientWithAppointmentForScope(
      tenant,
      scopedPayload,
    );
    if ("success" in result) {
      revalidateBookingPaths();
      revalidatePath("/staff/patients");
      revalidatePath("/admin/patients");
    }
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Update an existing booking (reschedule date/time, change doctor/branch,
 * update notes, or transition status) within strict role & clinical guardrails.
 */
export async function updateBooking(
  input: BookingUpdateInput,
): Promise<BookingActionResult<BookingDetail>> {
  try {
    const tenant = await requireTenantInfo();
    const perms = await resolveBookingPermissions(tenant);

    const parsed = bookingUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid booking update" };
    }

    const existing = await prisma.appointments.findFirst({
      where: {
        id: parsed.data.id,
        ...buildRoleScopeWhere(tenant, perms, { enforceActiveBranch: false }),
      },
      include: BOOKING_DETAIL_INCLUDE,
    });

    if (!existing) {
      return { error: "Booking not found or outside your access scope." };
    }

    const capabilities = computeBookingCapabilities({
      roleScope: perms.roleScope,
      status: existing.status as AppointmentStatus,
      appointmentDate: existing.appointment_date,
      canCreatePermission: perms.canCreate,
      canCancelPermission: perms.canCancel,
      branchLocked: tenant.branchLocked,
    });

    const data = parsed.data;
    const isDoctorChanging =
      data.doctor_id !== undefined && data.doctor_id !== existing.doctor_id;
    const isBranchChanging =
      data.branch_id !== undefined && data.branch_id !== existing.branch_id;
    const isCatalogItemChanging =
      perms.roleScope !== "patient" &&
      data.catalog_item_id !== undefined &&
      (data.catalog_item_id ?? null) !== (existing.catalog_item_id ?? null);
    const nextDate = data.appointment_date
      ? new Date(data.appointment_date)
      : existing.appointment_date;

    if (Number.isNaN(nextDate.getTime())) {
      return { error: "Invalid appointment date and time." };
    }

    const isDateChanging =
      data.appointment_date !== undefined &&
      nextDate.getTime() !== existing.appointment_date.getTime();
    const isNotesChanging =
      data.notes !== undefined &&
      (data.notes?.trim() || null) !== (existing.notes || null);
    const isDetailEdit =
      isDoctorChanging ||
      isBranchChanging ||
      isCatalogItemChanging ||
      isDateChanging ||
      isNotesChanging;

    if (isDetailEdit && !capabilities.canEditDetails) {
      return { error: "This booking can no longer be modified." };
    }
    if (isDoctorChanging && !capabilities.canChangeDoctor) {
      return { error: "You cannot reassign the doctor on this booking." };
    }
    if (isBranchChanging && !capabilities.canChangeBranch) {
      return { error: "You cannot change the branch on this booking." };
    }
    if (perms.roleScope === "patient" && isDateChanging && nextDate.getTime() <= Date.now()) {
      return { error: "Cannot reschedule an appointment into the past." };
    }

    const nextStatus = (data.status ?? existing.status) as AppointmentStatus;
    const isStatusChanging = data.status !== undefined && data.status !== existing.status;
    if (isStatusChanging) {
      if (nextStatus === "cancelled" && !capabilities.canCancel) {
        return { error: "You cannot cancel this booking." };
      }
      if (nextStatus === "checked_in" && !capabilities.canCheckIn) {
        return { error: "You cannot check in this booking." };
      }
      if (nextStatus === "completed" && !capabilities.canComplete) {
        return { error: "You cannot mark this booking as completed." };
      }
      if (nextStatus === "no_show" && !capabilities.canMarkNoShow) {
        return { error: "You cannot mark this booking as no-show." };
      }
      if (nextStatus === "scheduled" && !capabilities.canOverrideTerminal) {
        return { error: "Only administrators can reopen a closed booking." };
      }
    }

    const targetDoctorId = data.doctor_id ?? existing.doctor_id;
    const shouldCheckSchedule =
      Boolean(targetDoctorId) &&
      !TERMINAL_BOOKING_STATUSES.has(nextStatus) &&
      (isDoctorChanging ||
        isDateChanging ||
        (isStatusChanging &&
          TERMINAL_BOOKING_STATUSES.has(existing.status as AppointmentStatus)));

    let targetSlotDuration = SLOT_INTERVAL_MINUTES;
    if ((isDoctorChanging || shouldCheckSchedule) && targetDoctorId) {
      const doctorRecord = await prisma.profiles.findFirst({
        where: {
          id: targetDoctorId,
          tenant_id: tenant.clinicId,
          OR: [{ role: { in: ["doctor", "owner"] } }, { is_owner: true }],
        },
        select: {
          id: true,
          status: true,
          available_from: true,
          available_to: true,
          slot_duration_minutes: true,
          available_days: true,
        },
      });
      if (!doctorRecord) {
        return { error: "Selected doctor was not found in this clinic." };
      }

      const availability = normalizeDoctorAvailability(doctorRecord);
      targetSlotDuration = availability.slotDurationMinutes;
      if (shouldCheckSchedule) {
        const slotCheck = validateDoctorSlotAvailability(availability, nextDate);
        if (!slotCheck.valid) {
          return { error: slotCheck.message };
        }
      } else if (!availability.isActive) {
        return { error: "Selected doctor is not active in this clinic." };
      }
    }

    if (isBranchChanging && data.branch_id) {
      const linkedBranch = await prisma.clinic_branches.findFirst({
        where: {
          clinic_id: tenant.clinicId,
          branch_id: data.branch_id,
        },
        select: { branch_id: true },
      });
      if (!linkedBranch) {
        return { error: "Selected branch does not belong to this clinic." };
      }
    }

    if (isCatalogItemChanging && data.catalog_item_id) {
      const isCatalogValid = await validateActiveCatalogItem(
        tenant.clinicId,
        data.catalog_item_id,
      );
      if (!isCatalogValid) {
        return {
          error:
            "Selected service item is unavailable or not found in this clinic.",
        };
      }
    }

    if (shouldCheckSchedule && targetDoctorId) {
      const conflict = await hasActiveDoctorConflict({
        clinicId: tenant.clinicId,
        doctorId: targetDoctorId,
        targetDate: nextDate,
        slotDurationMinutes: targetSlotDuration,
        excludeBookingId: existing.id,
      });
      if (conflict) {
        return {
          error: `This doctor already has an appointment within ${targetSlotDuration} minutes of the selected time. Please choose another slot.`,
        };
      }
    }

    const updateData: Prisma.appointmentsUncheckedUpdateInput = {};
    if (data.doctor_id !== undefined) updateData.doctor_id = data.doctor_id;
    if (data.branch_id !== undefined) updateData.branch_id = data.branch_id;
    if (isCatalogItemChanging) {
      updateData.catalog_item_id = data.catalog_item_id ?? null;
    }
    if (data.appointment_date !== undefined) updateData.appointment_date = nextDate;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "checked_in" && existing.status !== "checked_in") {
        updateData.checked_in_at = new Date();
      } else if (data.status === "scheduled" && existing.status === "checked_in") {
        updateData.checked_in_at = null;
      }
    }

    const updated = await prisma.appointments.update({
      where: { id: existing.id },
      data: updateData,
      include: BOOKING_DETAIL_INCLUDE,
    });

    revalidateBookingPaths();
    return {
      success: true,
      data: mapBookingDetail(updated, perms, tenant.branchLocked),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update booking.",
    };
  }
}

/**
 * Cancel an appointment within the caller's role and permission scope.
 */
export async function cancelBooking(
  id: string,
): Promise<BookingActionResult<BookingDetail>> {
  return updateBooking({ id, status: "cancelled" });
}
