import { z } from "zod";

export const clinicStatusEnum = z.enum(["trial", "active", "suspended"]);
export const branchStatusEnum = z.enum(["active", "inactive"]);
export const profileStatusEnum = z.enum(["active", "inactive", "blocked"]);

export const clinicSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Clinic name must be at least 2 characters"),
  registration_number: z.string().optional().nullable(),
  email: z.email("Invalid email address").optional().nullable(),
  phone: z.string().optional().nullable(),
  subscription_plan: z.string().optional().nullable(),
  status: clinicStatusEnum,
});

export const branchSchema = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  name: z.string().min(2, "Branch name must be at least 2 characters"),
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

export const profileSchema = z.object({
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
});

/** Result of a create-and-invite action that surfaces a temp password. */
export type CreateAccountResult =
  | { success: true; tempPassword: string; fullName?: string | null }
  | { error: string };

export type Clinic = z.infer<typeof clinicSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type Profile = z.infer<typeof profileSchema>;

export interface ClinicWithBranches extends Clinic {
  branches: Branch[];
}
