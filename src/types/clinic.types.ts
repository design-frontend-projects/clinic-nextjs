import { z } from "zod";
import type { ClinicStatus, ProfileRole } from "@prisma/client";

export const clinicStatusEnum = z.enum(["trial", "active", "suspended"]);
export const branchStatusEnum = z.enum(["active", "inactive"]);
export const profileStatusEnum = z.enum(["active", "inactive", "blocked"]);

export const clinicSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Clinic name must be at least 2 characters"),
  registration_number: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  subscription_plan: z.string().optional().nullable(),
  specialty_id: z.string().uuid().optional().nullable(),
  status: clinicStatusEnum,
  have_pharmacy: z.boolean(),
  have_lab: z.boolean(),
  have_radio_center: z.boolean(),
  branch_ids: z
    .array(z.string().uuid())
    .min(1, "Select at least one branch"),
  primary_branch_id: z.string().uuid().optional().nullable(),
});

export const branchSchema = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2, "Branch name must be at least 2 characters"),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: branchStatusEnum,
  is_main: z.boolean().optional(),
});

/**
 * Profile roles a clinic admin/owner can assign when inviting personnel.
 * Subset of the Prisma `ProfileRole` enum — excludes owner/patient/app_owner/
 * super_admin, which are never granted through the invite flow.
 */
export const INVITABLE_PROFILE_ROLES = [
  "doctor",
  "staff",
  "admin",
  "pharmacist",
  "receptionist",
] as const;
export const invitableRoleEnum = z.enum(INVITABLE_PROFILE_ROLES);
export type InvitableProfileRole = z.infer<typeof invitableRoleEnum>;

/**
 * Roles locked to the branch assigned on their profile: their tenant context
 * always resolves `branchId` from `profiles.branch_id` (the branch-switcher
 * cookie is ignored) and the header shows a read-only clinic/branch display.
 * Owners and invited admins keep the free branch switcher.
 */
export const BRANCH_LOCKED_ROLES = [
  "doctor",
  "staff",
  "pharmacist",
  "receptionist",
] as const;

export function isBranchLockedRole(role: string | null | undefined): boolean {
  return (BRANCH_LOCKED_ROLES as readonly string[]).includes(role ?? "");
}

/**
 * Roles that can be assigned across multiple clinics/branches (via the
 * `profile_branches` pivot) and switch their active clinic + branch from the top
 * bar. These roles are NOT branch-locked when they have assignment rows: their
 * tenant context resolves the active clinic/branch from cookies validated
 * against their assignments (see `getTenantInfo`). Currently doctors only.
 */
export const MULTI_BRANCH_ROLES = ["doctor"] as const;

export function isMultiBranchRole(role: string | null | undefined): boolean {
  return (MULTI_BRANCH_ROLES as readonly string[]).includes(role ?? "");
}

/**
 * Roles previewed on each admin personnel page. The Doctors page also lists the
 * clinic owner (who may practice as a doctor); the Staff page lists every
 * non-doctor clinic role. Privileged/global roles (app_owner, super_admin) and
 * patients are intentionally excluded from both.
 */
export const DOCTOR_PAGE_ROLES = [
  "doctor",
  "owner",
] as const satisfies readonly ProfileRole[];
export const STAFF_PAGE_ROLES = [
  "staff",
  "admin",
  "pharmacist",
  "receptionist",
] as const satisfies readonly ProfileRole[];

export function rolesForPersonnelPage(
  page: "doctor" | "staff",
): readonly ProfileRole[] {
  return page === "doctor" ? DOCTOR_PAGE_ROLES : STAFF_PAGE_ROLES;
}

/** A single (clinic, branch) pair a multi-branch role may work in. */
export const doctorBranchAssignmentSchema = z.object({
  clinic_id: z.string().uuid(),
  branch_id: z.string().uuid(),
});
export type DoctorBranchAssignment = z.infer<typeof doctorBranchAssignmentSchema>;

export const SLOT_DURATION_OPTIONS = [15, 30] as const;
export type SlotDurationOption = (typeof SLOT_DURATION_OPTIONS)[number];
export const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;
export const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const doctorAvailabilitySchema = z
  .object({
    available_from: z.string().regex(HH_MM_REGEX, "Invalid start time (HH:mm)"),
    available_to: z.string().regex(HH_MM_REGEX, "Invalid end time (HH:mm)"),
    slot_duration_minutes: z.union([z.literal(15), z.literal(30)]),
    available_days: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Select at least one working day"),
  })
  .superRefine((data, ctx) => {
    if (data.available_from >= data.available_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time",
        path: ["available_to"],
      });
    }
  });

export type DoctorAvailabilityInput = z.infer<typeof doctorAvailabilitySchema>;

export const profileSchema = z
  .object({
    id: z.string().uuid().optional(),
    auth_user_id: z.string().optional(),
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.email("Invalid email address").optional().nullable(),
    phone: z.string().optional().nullable(),
    role: z.string(),
    // RBAC role (from the tenant's `roles` table) to assign on creation.
    role_id: z.string().uuid().optional().nullable(),
    specialty: z.string().optional().nullable(),
    status: profileStatusEnum,
    // Home branch within the clinic; required for new invites (enforced in the
    // server action so legacy edit payloads without the field keep working).
    branch_id: z.string().uuid().optional().nullable(),
    // Multi-branch roles (doctor): the full set of (clinic, branch) pairs the
    // person can work across. When present, drives `profile_branches` and the
    // home clinic/branch is derived from `primary_branch_id`.
    assignments: z.array(doctorBranchAssignmentSchema).optional(),
    // Which assigned branch is the home/default (must be one of `assignments`).
    primary_branch_id: z.string().uuid().optional().nullable(),
    // Doctor availability schedule fields
    available_from: z
      .string()
      .regex(HH_MM_REGEX, "Invalid start time")
      .optional()
      .nullable(),
    available_to: z
      .string()
      .regex(HH_MM_REGEX, "Invalid end time")
      .optional()
      .nullable(),
    slot_duration_minutes: z.union([z.literal(15), z.literal(30)]).optional(),
    available_days: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.available_from &&
      data.available_to &&
      data.available_from >= data.available_to
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time",
        path: ["available_to"],
      });
    }
    if (
      isMultiBranchRole(data.role) &&
      data.available_days !== undefined &&
      data.available_days.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one working day",
        path: ["available_days"],
      });
    }
  });

/** Result of a create-and-invite action that surfaces a temp password. */
export type CreateAccountResult =
  | { success: true; tempPassword: string; fullName?: string | null }
  | { error: string };

export type Clinic = z.infer<typeof clinicSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type Profile = z.infer<typeof profileSchema>;

export interface LinkedClinicSummary {
  id: string;
  name: string;
  is_primary: boolean;
}

export interface OwnerBranchItem {
  id: string;
  owner_id: string | null;
  clinic_id: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  status: "active" | "inactive";
  created_at: Date;
  linked_clinics: LinkedClinicSummary[];
}

export interface ClinicLinkedBranch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: "active" | "inactive";
  is_primary: boolean;
  created_at: Date;
}

export interface ClinicSpecialtySummary {
  id: string;
  name: string;
  name_ar: string | null;
  diagram_key: string;
}

export interface ClinicWithBranches {
  id: string;
  name: string;
  registration_number: string | null;
  email: string | null;
  phone: string | null;
  subscription_plan: string | null;
  specialty_id: string | null;
  specialty: ClinicSpecialtySummary | null;
  status: ClinicStatus;
  is_primary: boolean | null;
  have_pharmacy: boolean | null;
  have_lab: boolean | null;
  have_radio_center: boolean | null;
  created_at: Date;
  branches: ClinicLinkedBranch[];
}
