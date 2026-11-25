"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  profileSchema,
  doctorAvailabilitySchema,
  invitableRoleEnum,
  isBranchLockedRole,
  isMultiBranchRole,
  rolesForPersonnelPage,
  type Profile,
  type DoctorAvailabilityInput,
  type DoctorBranchAssignment,
  type CreateAccountResult,
} from "@/types/clinic.types";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import {
  findClinicDuplicate,
  duplicateMessage,
  findRbacRoleForProfileRole,
} from "@/lib/user-creation";
import { rbacService } from "@/features/rbac/services/rbac.service";

export async function getPersonnel(page: "doctor" | "staff") {
  const tenant = await requireTenantInfo();

  return prisma.profiles.findMany({
    where: {
      tenant_id: tenant.clinicId,
      role: { in: [...rolesForPersonnelPage(page)] },
    },
    include: {
      branches: { select: { id: true, name: true } },
      // Multi-clinic/branch assignments (doctors) so the edit form can preload
      // the current clinic/branch set.
      profile_branches: {
        select: { clinic_id: true, branch_id: true, is_primary: true },
      },
    },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Ensure the assigned branch exists and belongs to the acting tenant's clinic.
 * Prevents cross-tenant branch assignment via forged form payloads. `requireActive`
 * is enforced only when the branch is newly assigned/changed, so editing an
 * unrelated field on a profile whose branch was later deactivated still works.
 */
async function assertBranchInClinic(
  branchId: string,
  clinicId: string,
  requireActive = true,
) {
  const link = await prisma.clinic_branches.findFirst({
    where: {
      branch_id: branchId,
      clinic_id: clinicId,
      ...(requireActive && { branches: { status: "active" } }),
    },
    select: { id: true },
  });
  if (!link) {
    throw new Error("The selected branch does not belong to this clinic");
  }
}

/**
 * Resolve the set of clinics owned by the same owner as the acting clinic.
 * Multi-branch assignments may only span these clinics — never another owner's.
 */
async function getOwnerClinicIds(clinicId: string): Promise<Set<string>> {
  const current = await prisma.clinics.findUnique({
    where: { id: clinicId },
    select: { auth_user_id: true },
  });
  const ownerAuthId = current?.auth_user_id ?? null;
  if (!ownerAuthId) return new Set([clinicId]);

  const clinics = await prisma.clinics.findMany({
    where: { auth_user_id: ownerAuthId },
    select: { id: true },
  });
  return new Set(clinics.map((c) => c.id));
}

interface DoctorPlan {
  rows: { clinic_id: string; branch_id: string; is_primary: boolean }[];
  homeClinicId: string;
  homeBranchId: string;
}

/**
 * Validate doctor (clinic, branch) assignments against the owner's clinics and
 * their active branches, and pick the home/primary branch. Returns the rows to
 * persist into `profile_branches` plus the home clinic/branch to stamp onto the
 * profile (so single-clinic code paths and the first-login default keep working).
 */
async function resolveDoctorAssignments(
  assignments: DoctorBranchAssignment[] | undefined,
  primaryBranchId: string | null | undefined,
  ownerClinicIds: Set<string>,
): Promise<DoctorPlan> {
  if (!assignments || assignments.length === 0) {
    throw new Error("Select at least one clinic and branch for this doctor");
  }

  // Dedupe by (clinic_id, branch_id) — shared physical branches may appear under
  // multiple clinics (DB unique key is (profile_id, clinic_id, branch_id)).
  const byPair = new Map<string, { clinic_id: string; branch_id: string }>();
  for (const a of assignments) {
    if (!ownerClinicIds.has(a.clinic_id)) {
      throw new Error("A selected clinic is not available to you");
    }
    byPair.set(`${a.clinic_id}:${a.branch_id}`, {
      clinic_id: a.clinic_id,
      branch_id: a.branch_id,
    });
  }

  // Every (clinic, branch) pair must be linked in clinic_branches with an active branch.
  const pairs = [...byPair.values()];
  const uniqueClinicIds = Array.from(new Set(pairs.map((p) => p.clinic_id)));
  const uniqueBranchIds = Array.from(new Set(pairs.map((p) => p.branch_id)));

  const validLinks = await prisma.clinic_branches.findMany({
    where: {
      clinic_id: { in: uniqueClinicIds },
      branch_id: { in: uniqueBranchIds },
      branches: { status: "active" },
    },
    select: { clinic_id: true, branch_id: true },
  });
  const validPairKeys = new Set(
    validLinks.map((l) => `${l.clinic_id}:${l.branch_id}`),
  );
  for (const key of byPair.keys()) {
    if (!validPairKeys.has(key)) {
      throw new Error("A selected branch does not belong to its clinic");
    }
  }

  // Primary must be one of the assigned pairs; otherwise default to the first.
  const primaryPair =
    (primaryBranchId
      ? pairs.find((p) => p.branch_id === primaryBranchId)
      : undefined) ?? pairs[0];

  const rows = pairs.map((p) => ({
    clinic_id: p.clinic_id,
    branch_id: p.branch_id,
    is_primary:
      p.clinic_id === primaryPair.clinic_id &&
      p.branch_id === primaryPair.branch_id,
  }));

  return {
    rows,
    homeClinicId: primaryPair.clinic_id,
    homeBranchId: primaryPair.branch_id,
  };
}

/**
 * Grant the tenant's "Doctor" RBAC role in every assigned clinic, so the doctor
 * has their permissions in whichever clinic they switch to. `assignUserRoles`
 * uses set-semantics scoped per clinic, so this is idempotent per clinic.
 * Clinics without a matching seeded role are skipped (permissions can be granted
 * later from the RBAC settings screens).
 */
async function syncDoctorRoles(
  profileId: string,
  clinicIds: string[],
  actor: { id: string; email: string },
) {
  for (const clinicId of clinicIds) {
    const tenantRoles = await rbacService.getRoles(clinicId);
    const rbacRole = findRbacRoleForProfileRole(tenantRoles, "doctor");
    if (rbacRole) {
      await rbacService.assignUserRoles(
        clinicId,
        { profileId, roleIds: [rbacRole.id] },
        actor,
      );
    }
  }
}

/**
 * Create (invite) or update a doctor/staff profile.
 *
 * New records: block duplicates (email/phone within the clinic), create a
 * confirmed Supabase auth user with a temp password, upsert the profile (the
 * `on_auth_user_created` trigger pre-creates the row), and assign the tenant
 * RBAC role matching the selected profile role (skipped when the tenant has no
 * matching role, e.g. RBAC seeding was skipped). Returns the temp password to
 * surface to the inviting admin/owner.
 *
 * Doctors are multi-clinic/multi-branch: the payload carries `assignments`
 * (clinic+branch pairs) and `primary_branch_id`. Their home clinic/branch is
 * stamped onto the profile from the primary, `profile_branches` records the full
 * set, and the RBAC role is granted in every assigned clinic.
 */
function resolveAvailabilityPayload(validatedData: Profile) {
  const availableFrom = validatedData.available_from || "09:00";
  const availableTo = validatedData.available_to || "17:00";
  const slotDurationMinutes =
    validatedData.slot_duration_minutes === 15 ? 15 : 30;
  const availableDays =
    validatedData.available_days && validatedData.available_days.length > 0
      ? Array.from(new Set(validatedData.available_days)).sort((a, b) => a - b)
      : [0, 1, 2, 3, 4];

  return {
    available_from: availableFrom,
    available_to: availableTo,
    slot_duration_minutes: slotDurationMinutes,
    available_days: availableDays,
  };
}

function revalidatePersonnelAndBookingPaths(): void {
  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
  revalidatePath("/booking");
  revalidatePath("/staff/booking");
}

export async function upsertPersonnel(
  data: Profile,
): Promise<CreateAccountResult | { success: true }> {
  const tenant = await requireTenantInfo();
  await requirePermission("settings.users.manage");
  const validatedData = profileSchema.parse(data);

  const isNewRecord = !validatedData.id;
  const actor = {
    id: tenant.profileId,
    email: tenant.email || "system@clinicpro.com",
  };

  if (!isNewRecord) {
    // Scope the target profile to the acting tenant — never trust the id from
    // the client payload (prevents cross-tenant profile takeover).
    const existing = await prisma.profiles.findFirst({
      where: { id: validatedData.id, tenant_id: tenant.clinicId },
      select: { id: true, branch_id: true, role: true },
    });
    if (!existing) {
      throw new Error("Profile not found in this clinic");
    }

    // Doctor edit: replace the (clinic, branch) assignment set + schedule.
    if (isMultiBranchRole(existing.role) && validatedData.assignments) {
      const ownerClinicIds = await getOwnerClinicIds(tenant.clinicId);
      const plan = await resolveDoctorAssignments(
        validatedData.assignments,
        validatedData.primary_branch_id,
        ownerClinicIds,
      );
      const availability = resolveAvailabilityPayload(validatedData);

      await prisma.$transaction(async (tx) => {
        await tx.profiles.update({
          where: { id: existing.id },
          data: {
            full_name: validatedData.full_name,
            email: validatedData.email,
            phone: validatedData.phone ?? null,
            specialty: validatedData.specialty ?? null,
            status: validatedData.status,
            tenant_id: plan.homeClinicId,
            clinic_id: plan.homeClinicId,
            branch_id: plan.homeBranchId,
            ...availability,
          },
        });
        await tx.profile_branches.deleteMany({
          where: { profile_id: existing.id },
        });
        await tx.profile_branches.createMany({
          data: plan.rows.map((r) => ({ profile_id: existing.id, ...r })),
        });
      });

      await syncDoctorRoles(
        existing.id,
        [...new Set(plan.rows.map((r) => r.clinic_id))],
        actor,
      );

      revalidatePersonnelAndBookingPaths();
      return { success: true };
    }

    // Non-doctor edit: single-branch update (unchanged behavior).
    if (validatedData.branch_id) {
      await assertBranchInClinic(
        validatedData.branch_id,
        tenant.clinicId,
        validatedData.branch_id !== existing.branch_id,
      );
    }

    await prisma.profiles.update({
      where: { id: existing.id },
      data: {
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        specialty: validatedData.specialty ?? null,
        status: validatedData.status,
        ...(validatedData.branch_id !== undefined && {
          branch_id: validatedData.branch_id,
        }),
      },
    });

    revalidatePersonnelAndBookingPaths();
    return { success: true };
  }

  if (!validatedData.email) {
    throw new Error("Email is required to invite a new user");
  }

  // The invite form selects a ProfileRole enum value; only clinic staff roles
  // may be granted through this flow.
  const roleResult = invitableRoleEnum.safeParse(validatedData.role);
  if (!roleResult.success) {
    throw new Error("A valid role is required to invite a new user");
  }
  const profileRole = roleResult.data;

  // Resolve where the new profile "lives" (home clinic + branch). Doctors derive
  // it from their assignment set; other roles use the acting clinic + a single
  // (optional/required) branch.
  let doctorPlan: DoctorPlan | null = null;
  if (isMultiBranchRole(profileRole)) {
    const ownerClinicIds = await getOwnerClinicIds(tenant.clinicId);
    doctorPlan = await resolveDoctorAssignments(
      validatedData.assignments,
      validatedData.primary_branch_id,
      ownerClinicIds,
    );
  } else {
    // Branch-locked roles (staff/pharmacist/receptionist) must have a home
    // branch; for other roles (e.g. admin) branch is optional/informational.
    if (isBranchLockedRole(profileRole) && !validatedData.branch_id) {
      throw new Error("A branch is required to invite a new user");
    }
    if (validatedData.branch_id) {
      await assertBranchInClinic(validatedData.branch_id, tenant.clinicId);
    }
  }

  const homeClinicId = doctorPlan ? doctorPlan.homeClinicId : tenant.clinicId;
  const homeBranchId = doctorPlan
    ? doctorPlan.homeBranchId
    : (validatedData.branch_id ?? null);
  const doctorAvailability = isMultiBranchRole(profileRole)
    ? resolveAvailabilityPayload(validatedData)
    : {};

  // Block duplicates within the home clinic (by email or phone).
  const duplicate = await findClinicDuplicate({
    clinicId: homeClinicId,
    email: validatedData.email,
    phone: validatedData.phone,
  });
  if (duplicate) {
    throw new Error(duplicateMessage(duplicate));
  }

  // Create the confirmed auth user + temp password (Supabase admin).
  const { user, tempPassword } = await createUserAccount({
    email: validatedData.email,
    metadata: {
      full_name: validatedData.full_name,
      role: profileRole,
      tenant_id: homeClinicId,
    },
  });

  try {
    const profile = await prisma.profiles.upsert({
      where: { auth_user_id: user.id },
      update: {
        tenant_id: homeClinicId,
        clinic_id: homeClinicId,
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        role: profileRole,
        specialty: validatedData.specialty ?? null,
        status: validatedData.status || "active",
        is_owner: false,
        is_profile_completed: false,
        branch_id: homeBranchId,
        ...doctorAvailability,
      },
      create: {
        auth_user_id: user.id,
        tenant_id: homeClinicId,
        clinic_id: homeClinicId,
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        role: profileRole,
        specialty: validatedData.specialty ?? null,
        status: validatedData.status || "active",
        is_owner: false,
        is_profile_completed: false,
        branch_id: homeBranchId,
        ...doctorAvailability,
      },
    });

    if (doctorPlan) {
      // Record the full (clinic, branch) assignment set and grant the doctor
      // role in every assigned clinic.
      await prisma.profile_branches.deleteMany({
        where: { profile_id: profile.id },
      });
      await prisma.profile_branches.createMany({
        data: doctorPlan.rows.map((r) => ({ profile_id: profile.id, ...r })),
      });
      await syncDoctorRoles(
        profile.id,
        [...new Set(doctorPlan.rows.map((r) => r.clinic_id))],
        actor,
      );
    } else {
      // Single-clinic RBAC assignment (staff/admin/etc.).
      const tenantRoles = await rbacService.getRoles(tenant.clinicId);
      const rbacRole = findRbacRoleForProfileRole(tenantRoles, profileRole);
      if (rbacRole) {
        await rbacService.assignUserRoles(
          tenant.clinicId,
          { profileId: profile.id, roleIds: [rbacRole.id] },
          actor,
        );
      }
    }
  } catch (error) {
    console.error("Personnel creation failed, rolling back auth user:", error);
    await rollbackAuthUser(user.id);
    throw new Error(
      "Failed to create the profile. The invitation was rolled back.",
    );
  }

  revalidatePersonnelAndBookingPaths();
  return { success: true, tempPassword, fullName: validatedData.full_name };
}

/**
 * Allows the clinic owner (who may practice as a doctor on /admin/doctors)
 * to configure their own availability hours, working days, and slot duration.
 */
export async function updateOwnerDoctorAvailability(
  input: DoctorAvailabilityInput,
): Promise<{ success: true }> {
  const tenant = await requireTenantInfo();
  if (!tenant.is_owner && tenant.role !== "owner") {
    throw new Error("Only the clinic owner can update the owner schedule");
  }

  const parsed = doctorAvailabilitySchema.parse(input);
  const availableDays = Array.from(new Set(parsed.available_days)).sort(
    (a, b) => a - b,
  );

  await prisma.profiles.update({
    where: { id: tenant.profileId },
    data: {
      available_from: parsed.available_from,
      available_to: parsed.available_to,
      slot_duration_minutes: parsed.slot_duration_minutes,
      available_days: availableDays,
    },
  });

  revalidatePersonnelAndBookingPaths();
  return { success: true };
}

export async function deletePersonnel(id: string) {
  await requireTenantInfo();
  await requirePermission("settings.users.manage");

  await prisma.profiles.delete({
    where: { id },
  });

  revalidatePersonnelAndBookingPaths();
}
