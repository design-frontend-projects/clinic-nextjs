// src/features/rbac/actions.ts
"use server";

import { requireTenantInfo, getTenantInfo } from "@/lib/auth";
import { rbacService } from "./services/rbac.service";
import { evaluationService } from "./services/evaluation.service";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "./middleware";
import {
  RoleCreateInput,
  RoleUpdateInput,
  UserRoleAssignInput,
  UserPermissionOverrideInput,
  RoleHierarchyLinkInput,
  AuditLogsQueryInput,
} from "./domain/dtos";

// Helper to safely extract error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Utility helper to get current actor details from auth context
async function getActor() {
  const tenant = await requireTenantInfo();
  return {
    id: tenant.profileId,
    email: tenant.email || "system@clinicpro.com",
    clinicId: tenant.clinicId,
  };
}

// 1. Fetch current logged in user authorization context
export async function getUserAuthorizationAction() {
  try {
    const tenant = await getTenantInfo();
    if (!tenant || !tenant.clinicId) {
      return { error: "Unauthenticated" };
    }

    const clinic = await prisma.clinics.findFirst({
      where: { id: tenant.clinicId },
      select: { name: true },
    });

    const userRoles = await rbacService.getUserRoles(
      tenant.clinicId,
      tenant.profileId,
    );
    const roleNames = userRoles.map((ur) => ur.roles.name);

    // Evaluate permissions
    const permissions = await evaluationService.getUserActivePermissions(
      tenant.clinicId,
      tenant.profileId,
    );

    return {
      data: {
        user: {
          id: tenant.profileId,
          email: tenant.email,
          fullName: tenant.fullName,
        },
        tenant: {
          clinicId: tenant.clinicId,
          name: clinic?.name || "Clinic",
        },
        roles: roleNames,
        permissions,
      },
    };
  } catch (error: unknown) {
    return {
      error: getErrorMessage(error) || "Failed to retrieve authorization data",
    };
  }
}

// 2. Roles list
export async function getRolesAction() {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const data = await rbacService.getRoles(actor.clinicId);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 3. Role details
export async function getRoleDetailsAction(roleId: string) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const data = await rbacService.getRole(actor.clinicId, roleId);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 4. Create Role
export async function createRoleAction(input: RoleCreateInput) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const role = await rbacService.createRole(actor.clinicId, input, actor);
    revalidatePath("/settings/roles");
    return { success: true, data: role };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 5. Update Role
export async function updateRoleAction(roleId: string, input: RoleUpdateInput) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const role = await rbacService.updateRole(
      actor.clinicId,
      roleId,
      input,
      actor,
    );
    revalidatePath("/settings/roles");
    revalidatePath(`/settings/roles/${roleId}`);
    return { success: true, data: role };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 6. Delete Role
export async function deleteRoleAction(roleId: string) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    await rbacService.deleteRole(actor.clinicId, roleId, actor);
    revalidatePath("/settings/roles");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 7. Clone Role
export async function cloneRoleAction(roleId: string, newName: string) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const role = await rbacService.cloneRole(
      actor.clinicId,
      roleId,
      newName,
      actor,
    );
    revalidatePath("/settings/roles");
    return { success: true, data: role };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 8. Toggle Active
export async function toggleRoleActiveAction(
  roleId: string,
  isActive: boolean,
) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const role = await rbacService.toggleRoleActive(
      actor.clinicId,
      roleId,
      isActive,
      actor,
    );
    revalidatePath("/settings/roles");
    return { success: true, data: role };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 9. Permissions list
export async function getPermissionsAction() {
  try {
    await requireTenantInfo();
    const data = await rbacService.getPermissions();
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 10. Categories list
export async function getPermissionCategoriesAction() {
  try {
    await requireTenantInfo();
    const data = await rbacService.getPermissionCategories();
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 11. Groups list
export async function getPermissionGroupsAction() {
  try {
    await requireTenantInfo();
    const data = await rbacService.getPermissionGroups();
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 12. Assign User Roles
export async function assignUserRolesAction(input: UserRoleAssignInput) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const data = await rbacService.assignUserRoles(
      actor.clinicId,
      input,
      actor,
    );
    revalidatePath("/settings/user-roles");
    revalidatePath("/settings/users");
    return { success: true, data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 13. Set User Override Permission
export async function setUserPermissionOverrideAction(
  input: UserPermissionOverrideInput,
) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const data = await rbacService.setUserPermissionOverride(
      actor.clinicId,
      input,
      actor,
    );
    revalidatePath("/settings/user-roles");
    return { success: true, data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 14. Get Hierarchy
export async function getRoleHierarchyAction() {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const data = await rbacService.getRoleHierarchy(actor.clinicId);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 15. Add Hierarchy Link
export async function addRoleHierarchyLinkAction(
  input: RoleHierarchyLinkInput,
) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    const data = await rbacService.addRoleHierarchyLink(
      actor.clinicId,
      input,
      actor,
    );
    revalidatePath("/settings/roles");
    return { success: true, data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 16. Remove Hierarchy Link
export async function removeRoleHierarchyLinkAction(
  parentRoleId: string,
  childRoleId: string,
) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");
    await rbacService.removeRoleHierarchyLink(
      actor.clinicId,
      parentRoleId,
      childRoleId,
      actor,
    );
    revalidatePath("/settings/roles");
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 17. Get Audit Logs
export async function getAuditLogsAction(query: AuditLogsQueryInput) {
  try {
    const actor = await getActor();
    await requirePermission("settings.audit.read");
    const data = await rbacService.audit.getLogs(actor.clinicId, query);
    return { data };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 18. Get User profiles (Staff/Users)
export async function getProfilesAction() {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");

    // Fetch all profiles belonging to the same clinic
    const profiles = await prisma.profiles.findMany({
      // where: {
      //   user_roles: {
      //     some: { tenant_id: actor.clinicId }
      //   }
      // },
      include: {
        user_roles: {
          include: { roles: true },
        },
      },
    });

    return { data: profiles };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 19. Get Clinic profiles (All profiles registered in the system - helper for assignments)
export async function getAllProfilesAction() {
  try {
    await requirePermission("settings.roles.manage");
    const profiles = await prisma.profiles.findMany({
      orderBy: { full_name: "asc" },
    });
    return { data: profiles };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 20. Update single role-permission mapping
export async function setRolePermissionCellAction(
  roleId: string,
  permissionId: string,
  state: "allow" | "deny" | "none",
) {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");

    if (state === "none") {
      await prisma.role_permissions.deleteMany({
        where: {
          tenant_id: actor.clinicId,
          role_id: roleId,
          permission_id: permissionId,
        },
      });
    } else {
      const isDeny = state === "deny";
      await prisma.role_permissions.upsert({
        where: {
          tenant_id_role_id_permission_id: {
            tenant_id: actor.clinicId,
            role_id: roleId,
            permission_id: permissionId,
          },
        },
        update: { is_deny: isDeny, deleted_at: null, is_active: true },
        create: {
          tenant_id: actor.clinicId,
          role_id: roleId,
          permission_id: permissionId,
          is_deny: isDeny,
        },
      });
    }

    const { cacheService } = await import("./services/cache.service");
    await cacheService.invalidateTenant(actor.clinicId);

    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// 21. Fetch flat role-permissions mappings for matrix view
export async function getRolePermissionsMatrixDataAction() {
  try {
    const actor = await getActor();
    await requirePermission("settings.roles.manage");

    const rolePermissions = await prisma.role_permissions.findMany({
      where: { tenant_id: actor.clinicId, deleted_at: null },
      select: { role_id: true, permission_id: true, is_deny: true },
    });

    return {
      data: rolePermissions.map((rp) => ({
        roleId: rp.role_id,
        permissionId: rp.permission_id,
        isDeny: rp.is_deny,
      })),
    };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}
