// src/features/rbac/services/rbac.service.ts
import { RBACRepository } from "../repositories/rbac.repository";
import { cacheService } from "./cache.service";
import { auditService } from "./audit.service";
import {
  RoleCreateSchema,
  RoleCreateInput,
  RoleUpdateSchema,
  RoleUpdateInput,
  PermissionCreateSchema,
  PermissionCreateInput,
  UserRoleAssignSchema,
  UserRoleAssignInput,
  UserPermissionOverrideSchema,
  UserPermissionOverrideInput,
  RoleHierarchyLinkSchema,
  RoleHierarchyLinkInput
} from "../domain/dtos";

export class RBACService {
  constructor(
    private repo: RBACRepository = new RBACRepository(),
    private cache = cacheService,
    public readonly audit = auditService
  ) {}

  // --- Role Management ---

  async getRoles(tenantId: string) {
    return this.repo.findRolesByTenant(tenantId);
  }

  async getRole(tenantId: string, roleId: string) {
    const role = await this.repo.findRoleById(tenantId, roleId);
    if (!role) return null;

    const permissions = await this.repo.findRolePermissions(tenantId, roleId);
    return {
      ...role,
      permissions: permissions.map((rp) => ({
        id: rp.permissions.id,
        name: rp.permissions.name,
        is_deny: rp.is_deny
      }))
    };
  }

  async createRole(
    tenantId: string,
    input: RoleCreateInput,
    actor: { id: string; email: string }
  ) {
    const data = RoleCreateSchema.parse(input);

    // Check unique role name in tenant
    const existing = await this.repo.findRoleByName(tenantId, data.name);
    if (existing) {
      throw new Error(`Role name '${data.name}' already exists in this clinic`);
    }

    return this.repo.runInTransaction(async (tx) => {
      // 1. Create role
      const role = await this.repo.createRole(
        tenantId,
        data.name.trim(),
        data.description ?? null,
        false,
        actor.id,
        tx
      );

      // 2. Set permissions (if provided)
      if (data.permissionIds.length > 0) {
        await this.repo.setRolePermissions(tenantId, role.id, data.permissionIds, actor.id, tx);
      }

      // 3. Set parent hierarchy link (if provided)
      if (data.parentRoleId) {
        await this.repo.addRoleHierarchyLink(tenantId, data.parentRoleId, role.id, actor.id, tx);
      }

      // 4. Invalidate cache
      await this.cache.invalidateTenant(tenantId);

      // 5. Log audit
      await this.audit.logChange(tenantId, "ROLE_CREATED", {
        actorId: actor.id,
        actorEmail: actor.email,
        entityType: "role",
        entityId: role.id,
        oldValues: null,
        newValues: { name: role.name, description: role.description, permissionsCount: data.permissionIds.length }
      });

      return role;
    });
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    input: Omit<RoleUpdateInput, "id">,
    actor: { id: string; email: string }
  ) {
    const data = RoleUpdateSchema.parse({ ...input, id: roleId });

    // Fetch existing
    const role = await this.repo.findRoleById(tenantId, roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    // Check unique name on rename
    if (data.name && data.name.toLowerCase() !== role.name.toLowerCase()) {
      const existing = await this.repo.findRoleByName(tenantId, data.name);
      if (existing) {
        throw new Error(`Role name '${data.name}' already exists`);
      }
    }

    return this.repo.runInTransaction(async (tx) => {
      // 1. Update basic info
      const oldValues = { name: role.name, description: role.description, is_active: role.is_active };
      const updated = await this.repo.updateRole(
        tenantId,
        roleId,
        {
          name: data.name,
          description: data.description,
          is_active: data.is_active
        },
        actor.id,
        tx
      );

      // 2. Reset and set permissions
      if (data.permissionIds) {
        await this.repo.setRolePermissions(tenantId, roleId, data.permissionIds, actor.id, tx);
      }

      // 3. Update hierarchy parent if specified
      if (data.parentRoleId !== undefined) {
        // Delete old parent hierarchies where this role is child
        await tx.role_hierarchy.deleteMany({
          where: { tenant_id: tenantId, child_role_id: roleId }
        });
        if (data.parentRoleId) {
          // Verify no cycles
          if (data.parentRoleId === roleId) {
            throw new Error("Role cannot inherit from itself");
          }
          await this.repo.addRoleHierarchyLink(tenantId, data.parentRoleId, roleId, actor.id, tx);
        }
      }

      // 4. Invalidate cache
      await this.cache.invalidateTenant(tenantId);

      // 5. Log audit
      await this.audit.logChange(tenantId, "ROLE_UPDATED", {
        actorId: actor.id,
        actorEmail: actor.email,
        entityType: "role",
        entityId: roleId,
        oldValues,
        newValues: { name: updated.name, description: updated.description, is_active: updated.is_active }
      });

      return updated;
    });
  }

  async deleteRole(
    tenantId: string,
    roleId: string,
    actor: { id: string; email: string }
  ) {
    const role = await this.repo.findRoleById(tenantId, roleId);
    if (!role) {
      throw new Error("Role not found");
    }
    if (role.is_system) {
      throw new Error("System roles cannot be deleted");
    }

    return this.repo.runInTransaction(async (tx) => {
      // Delete user links
      await tx.user_roles.deleteMany({ where: { tenant_id: tenantId, role_id: roleId } });
      
      // Soft delete role
      await this.repo.softDeleteRole(tenantId, roleId, actor.id, tx);

      await this.cache.invalidateTenant(tenantId);

      await this.audit.logChange(tenantId, "ROLE_DELETED", {
        actorId: actor.id,
        actorEmail: actor.email,
        entityType: "role",
        entityId: roleId,
        oldValues: { name: role.name },
        newValues: null
      });

      return { success: true };
    });
  }

  async cloneRole(
    tenantId: string,
    roleId: string,
    newName: string,
    actor: { id: string; email: string }
  ) {
    const role = await this.getRole(tenantId, roleId);
    if (!role) {
      throw new Error("Source role not found");
    }

    const permissionIds = role.permissions.map((p) => p.id);

    return this.createRole(
      tenantId,
      {
        name: newName,
        description: `Clone of ${role.name}. ${role.description || ""}`,
        is_active: role.is_active,
        permissionIds,
        parentRoleId: null
      },
      actor
    );
  }

  async toggleRoleActive(
    tenantId: string,
    roleId: string,
    isActive: boolean,
    actor: { id: string; email: string }
  ) {
    const role = await this.repo.findRoleById(tenantId, roleId);
    if (!role) throw new Error("Role not found");

    const updated = await this.repo.updateRole(tenantId, roleId, { is_active: isActive }, actor.id);
    await this.cache.invalidateTenant(tenantId);

    await this.audit.logChange(tenantId, isActive ? "ROLE_ACTIVATED" : "ROLE_DISABLED", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "role",
      entityId: roleId,
      oldValues: { is_active: role.is_active },
      newValues: { is_active: isActive }
    });

    return updated;
  }

  // --- Permission Management ---

  async getPermissions() {
    return this.repo.findPermissions();
  }

  async getPermissionCategories() {
    return this.repo.findPermissionCategories();
  }

  async getPermissionGroups() {
    return this.repo.findPermissionGroups();
  }

  async createPermission(
    tenantId: string | null,
    input: PermissionCreateInput,
    actor: { id: string; email: string }
  ) {
    const data = PermissionCreateSchema.parse(input);

    const existing = await this.repo.findPermissionByName(data.name);
    if (existing) {
      throw new Error(`Permission name '${data.name}' already exists`);
    }

    const permission = await this.repo.createPermission(
      tenantId,
      data.name.trim(),
      data.description ?? null,
      data.category_id ?? null,
      data.group_id ?? null,
      actor.id
    );

    if (tenantId) {
      await this.cache.invalidateTenant(tenantId);
    }

    return permission;
  }

  // --- User Roles Assignment ---

  async getUserRoles(tenantId: string, profileId: string) {
    return this.repo.findUserRoles(tenantId, profileId);
  }

  async assignUserRoles(
    tenantId: string,
    input: UserRoleAssignInput,
    actor: { id: string; email: string }
  ) {
    const data = UserRoleAssignSchema.parse(input);

    // Fetch old roles for audit log
    const oldUserRoles = await this.repo.findUserRoles(tenantId, data.profileId);
    const oldRoleNames = oldUserRoles.map((ur) => ur.roles.name);

    const result = await this.repo.setUserRoles(tenantId, data.profileId, data.roleIds, actor.id);

    // Fetch new role names
    const newUserRoles = await this.repo.findUserRoles(tenantId, data.profileId);
    const newRoleNames = newUserRoles.map((ur) => ur.roles.name);

    // Clear permissions cache for this user
    await this.cache.invalidateUser(tenantId, data.profileId);

    // Log audit
    await this.audit.logChange(tenantId, "USER_ROLES_ASSIGNED", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "user_role",
      entityId: data.profileId,
      oldValues: { roles: oldRoleNames },
      newValues: { roles: newRoleNames }
    });

    return result;
  }

  // --- Custom Direct & Temporary Permission Overrides ---

  async setUserPermissionOverride(
    tenantId: string,
    input: UserPermissionOverrideInput,
    actor: { id: string; email: string }
  ) {
    const data = UserPermissionOverrideSchema.parse(input);

    const result = await this.repo.setUserPermissionOverride(
      tenantId,
      data.profileId,
      data.permissionId,
      data.is_deny,
      data.expires_at,
      actor.id
    );

    await this.cache.invalidateUser(tenantId, data.profileId);

    await this.audit.logChange(tenantId, "USER_PERMISSION_CHANGED", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "user_permission",
      entityId: data.profileId,
      oldValues: null,
      newValues: { permissionId: data.permissionId, isDeny: data.is_deny, expiresAt: data.expires_at }
    });

    return result;
  }

  // --- Role Hierarchy ---

  async getRoleHierarchy(tenantId: string) {
    return this.repo.findRoleHierarchy(tenantId);
  }

  async addRoleHierarchyLink(
    tenantId: string,
    input: RoleHierarchyLinkInput,
    actor: { id: string; email: string }
  ) {
    const data = RoleHierarchyLinkSchema.parse(input);

    if (data.parentRoleId === data.childRoleId) {
      throw new Error("Circular inheritance is forbidden");
    }

    const result = await this.repo.addRoleHierarchyLink(
      tenantId,
      data.parentRoleId,
      data.childRoleId,
      actor.id
    );

    await this.cache.invalidateTenant(tenantId);

    await this.audit.logChange(tenantId, "ROLE_HIERARCHY_LINKED", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "role_hierarchy",
      entityId: data.parentRoleId,
      oldValues: null,
      newValues: { parent: data.parentRoleId, child: data.childRoleId }
    });

    return result;
  }

  async removeRoleHierarchyLink(
    tenantId: string,
    parentRoleId: string,
    childRoleId: string,
    actor: { id: string; email: string }
  ) {
    const result = await this.repo.removeRoleHierarchyLink(tenantId, parentRoleId, childRoleId);

    await this.cache.invalidateTenant(tenantId);

    await this.audit.logChange(tenantId, "ROLE_HIERARCHY_UNLINKED", {
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "role_hierarchy",
      entityId: parentRoleId,
      oldValues: { parent: parentRoleId, child: childRoleId },
      newValues: null
    });

    return result;
  }
}
export const rbacService = new RBACService();
