"use server";

import { prisma } from "@/lib/prisma";
import { getTenantInfo, requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";

// --- Helper Functions ---
async function verifyAdmin() {
  const tenant = await requireTenantInfo();
  if (tenant.role !== "admin") {
    throw new Error("Unauthorized: Only admins can perform RBAC actions.");
  }
  return tenant;
}

// --- Roles & Permissions Management ---

export async function getClinicRoles() {
  const tenant = await requireTenantInfo();
  return prisma.roles.findMany({
    where: { clinic_id: tenant.clinicId },
    include: {
      role_permissions: {
        include: {
          permissions: true,
        },
      },
    },
  });
}

export async function getAllPermissions() {
  await requireTenantInfo(); // require login only
  return prisma.permissions.findMany();
}

export async function createRole(name: string, permissionIds: string[]) {
  const tenant = await verifyAdmin();

  try {
    const role = await prisma.roles.create({
      data: {
        clinic_id: tenant.clinicId,
        name,
        role_permissions: {
          create: permissionIds.map((permission_id) => ({
            permission_id,
          })),
        },
      },
    });

    revalidatePath("/admin/rbac");
    return { success: true, role };
  } catch (error) {
    console.error("Failed to create role: ", error);
    return { error: "Failed to create role." };
  }
}

export async function updateRole(
  roleId: string,
  name: string,
  permissionIds: string[],
) {
  const tenant = await verifyAdmin();

  try {
    // verify role belongs to this clinic
    const existingRole = await prisma.roles.findFirst({
      where: { id: roleId, clinic_id: tenant.clinicId },
    });

    if (!existingRole) throw new Error("Role not found or unauthorized");

    // Update name and reset permissions
    // Run in transaction: delete old permissions, set new ones
    await prisma.$transaction([
      prisma.roles.update({
        where: { id: roleId },
        data: { name },
      }),
      prisma.role_permissions.deleteMany({
        where: { role_id: roleId },
      }),
      prisma.role_permissions.createMany({
        data: permissionIds.map((permission_id) => ({
          role_id: roleId,
          permission_id,
        })),
      }),
    ]);

    revalidatePath("/admin/rbac");
    return { success: true };
  } catch (error) {
    console.error("Failed to update role:", error);
    return { error: "Failed to update role." };
  }
}

export async function deleteRole(roleId: string) {
  const tenant = await verifyAdmin();

  try {
    // Verify role ownership
    const existingRole = await prisma.roles.findFirst({
      where: { id: roleId, clinic_id: tenant.clinicId },
    });

    if (!existingRole) throw new Error("Role not found");

    await prisma.roles.delete({
      where: { id: roleId },
    });

    revalidatePath("/admin/rbac");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete role:", error);
    return { error: "Failed to delete role" };
  }
}

// --- Staff Management ---

export async function getClinicStaff() {
  const tenant = await requireTenantInfo();

  const staffs = await prisma.profiles.findMany({
    where: {
      clinic_id: tenant.clinicId,
      // exclude the self or return all, based on preference.
    },
    include: {
      profile_roles: {
        include: {
          roles: true,
        },
      },
    },
  });

  // To prevent exposing everyone's stuff, we return just what's needed
  return staffs.map((staff) => ({
    id: staff.id,
    full_name: staff.full_name,
    email: staff.email,
    clerk_user_id: staff.clerk_user_id,
    role: staff.role,
    assigned_roles: staff.profile_roles.map((pr) => pr.roles),
  }));
}

export async function assignStaffRoles(profileId: string, roleIds: string[]) {
  const tenant = await verifyAdmin();

  try {
    // Verify profile exists in this clinic
    const profile = await prisma.profiles.findFirst({
      where: { id: profileId, clinic_id: tenant.clinicId },
    });

    if (!profile) return { error: "Profile not found in this clinic" };

    // Reset and Create
    await prisma.$transaction([
      prisma.profile_roles.deleteMany({
        where: { profile_id: profileId },
      }),
      prisma.profile_roles.createMany({
        data: roleIds.map((role_id) => ({
          profile_id: profileId,
          role_id,
        })),
      }),
    ]);

    revalidatePath("/admin/rbac");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign staff roles", error);
    return { error: "Failed to assign roles" };
  }
}
