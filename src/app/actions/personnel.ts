"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  profileSchema,
  invitableRoleEnum,
  type Profile,
  type CreateAccountResult,
} from "@/types/clinic.types";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import {
  findClinicDuplicate,
  duplicateMessage,
  findRbacRoleForProfileRole,
} from "@/lib/user-creation";
import { rbacService } from "@/features/rbac/services/rbac.service";

export async function getPersonnel(userId: string) {
  const tenant = await requireTenantInfo();

  return prisma.profiles.findMany({
    where: {
      tenant_id: tenant.clinicId,
    },
    orderBy: { created_at: "desc" },
  });
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
 */
export async function upsertPersonnel(
  data: Profile,
): Promise<CreateAccountResult | { success: true }> {
  const tenant = await requireTenantInfo();
  await requirePermission("settings.users.manage");
  const validatedData = profileSchema.parse(data);

  const isNewRecord = !validatedData.id;

  if (!isNewRecord) {
    // Update existing profile in database
    await prisma.profiles.update({
      where: { id: validatedData.id },
      data: {
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        specialty: validatedData.specialty ?? null,
        status: validatedData.status,
      },
    });

    revalidatePath("/admin/doctors");
    revalidatePath("/admin/staff");
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

  // Best-effort permissions: match the selected profile role to one of the
  // tenant's seeded RBAC roles. Tenants without seeded roles get no assignment;
  // permissions can be granted later from the RBAC settings screens.
  const tenantRoles = await rbacService.getRoles(tenant.clinicId);
  const rbacRole = findRbacRoleForProfileRole(tenantRoles, profileRole);

  // Block duplicates within the clinic (by email or phone).
  const duplicate = await findClinicDuplicate({
    clinicId: tenant.clinicId,
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
      tenant_id: tenant.clinicId,
    },
  });

  try {
    const profile = await prisma.profiles.upsert({
      where: { auth_user_id: user.id },
      update: {
        tenant_id: tenant.clinicId,
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        role: profileRole,
        specialty: validatedData.specialty ?? null,
        status: validatedData.status || "active",
        is_owner: false,
        is_profile_completed: false,
      },
      create: {
        auth_user_id: user.id,
        tenant_id: tenant.clinicId,
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        role: profileRole,
        specialty: validatedData.specialty ?? null,
        status: validatedData.status || "active",
        is_owner: false,
        is_profile_completed: false,
      },
    });

    // Assign the matching RBAC role (writes user_roles + invalidates cache +
    // audit log). Skipped when the tenant has no matching role.
    if (rbacRole) {
      await rbacService.assignUserRoles(
        tenant.clinicId,
        { profileId: profile.id, roleIds: [rbacRole.id] },
        { id: tenant.profileId, email: tenant.email || "system@clinicpro.com" },
      );
    }
  } catch (error) {
    console.error("Personnel creation failed, rolling back auth user:", error);
    await rollbackAuthUser(user.id);
    throw new Error("Failed to create the profile. The invitation was rolled back.");
  }

  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
  return { success: true, tempPassword, fullName: validatedData.full_name };
}

export async function deletePersonnel(id: string) {
  await requireTenantInfo();
  await requirePermission("settings.users.manage");

  await prisma.profiles.delete({
    where: { id },
  });

  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
}
