// src/app/actions/rbac.ts
"use server";

import { rbacService } from "@/features/rbac/services/rbac.service";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getClinicRoles() {
  const tenant = await requireTenantInfo();
  const roles = await rbacService.getRoles(tenant.clinicId);
  const detailedRoles = await Promise.all(
    roles.map(async (r) => {
      const detail = await rbacService.getRole(tenant.clinicId, r.id);
      return {
        id: r.id,
        name: r.name,
        clinic_id: r.tenant_id,
        is_active: r.is_active,
        role_permissions: detail?.permissions.map((p) => ({
          permissions: { id: p.id, name: p.name }
        })) || []
      };
    })
  );
  return detailedRoles;
}

export async function getAllPermissions() {
  return rbacService.getPermissions();
}

export async function createRole(name: string, permissionIds: string[]) {
  const tenant = await requireTenantInfo();
  try {
    const role = await rbacService.createRole(
      tenant.clinicId,
      { name, permissionIds },
      { id: tenant.profileId, email: tenant.email || "system@clinicpro.com" }
    );
    revalidatePath("/admin/rbac");
    return { success: true, role };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateRole(roleId: string, name: string, permissionIds: string[]) {
  const tenant = await requireTenantInfo();
  try {
    await rbacService.updateRole(
      tenant.clinicId,
      roleId,
      { name, permissionIds },
      { id: tenant.profileId, email: tenant.email || "system@clinicpro.com" }
    );
    revalidatePath("/admin/rbac");
    return { success: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteRole(roleId: string) {
  const tenant = await requireTenantInfo();
  try {
    await rbacService.deleteRole(
      tenant.clinicId,
      roleId,
      { id: tenant.profileId, email: tenant.email || "system@clinicpro.com" }
    );
    revalidatePath("/admin/rbac");
    return { success: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getClinicStaff() {
  const tenant = await requireTenantInfo();
  const { prisma } = await import("@/lib/prisma");
  const staffs = await prisma.profiles.findMany({
    orderBy: { full_name: "asc" }
  });

  const detailedStaffs = await Promise.all(
    staffs.map(async (staff) => {
      const userRoles = await rbacService.getUserRoles(tenant.clinicId, staff.id);
      return {
        id: staff.id,
        full_name: staff.full_name,
        email: staff.email,
        auth_user_id: staff.auth_user_id,
        role: userRoles[0]?.roles.name || "Viewer",
        assigned_roles: userRoles.map((ur: any) => ({
          id: ur.roles.id,
          name: ur.roles.name,
        }))
      };
    })
  );

  return detailedStaffs;
}

export async function assignStaffRoles(profileId: string, roleIds: string[]) {
  const tenant = await requireTenantInfo();
  try {
    await rbacService.assignUserRoles(
      tenant.clinicId,
      { profileId, roleIds },
      { id: tenant.profileId, email: tenant.email || "system@clinicpro.com" }
    );
    revalidatePath("/admin/rbac");
    return { success: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
