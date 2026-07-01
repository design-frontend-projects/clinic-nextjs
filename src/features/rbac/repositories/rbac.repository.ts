// src/features/rbac/repositories/rbac.repository.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AuditLogsQuery } from "../domain/dtos";

export class RBACRepository {
  // --- Transaction Support ---
  async runInTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(callback);
  }

  // --- Role Repositories ---
  async findRolesByTenant(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.roles.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: { created_at: "asc" }
    });
  }

  async findRoleById(tenantId: string, roleId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.roles.findFirst({
      where: { id: roleId, tenant_id: tenantId, deleted_at: null }
    });
  }

  async findRoleByName(tenantId: string, name: string, tx: Prisma.TransactionClient = prisma) {
    return tx.roles.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, tenant_id: tenantId, deleted_at: null }
    });
  }

  async createRole(
    tenantId: string,
    name: string,
    description: string | null,
    isSystem = false,
    createdBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.roles.create({
      data: {
        tenant_id: tenantId,
        name,
        description,
        is_system: isSystem,
        created_by: createdBy,
        updated_by: createdBy
      }
    });
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    data: { name?: string; description?: string | null; is_active?: boolean },
    updatedBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.roles.update({
      where: { id: roleId, tenant_id: tenantId },
      data: {
        ...data,
        updated_by: updatedBy,
        updated_at: new Date()
      }
    });
  }

  async softDeleteRole(
    tenantId: string,
    roleId: string,
    deletedBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.roles.update({
      where: { id: roleId, tenant_id: tenantId },
      data: {
        deleted_at: new Date(),
        updated_by: deletedBy,
        is_active: false
      }
    });
  }

  // --- Permission Repositories ---
  async findPermissions(tx: Prisma.TransactionClient = prisma) {
    return tx.permissions.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" }
    });
  }

  async findPermissionCategories(tx: Prisma.TransactionClient = prisma) {
    return tx.permission_categories.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" }
    });
  }

  async findPermissionGroups(tx: Prisma.TransactionClient = prisma) {
    return tx.permission_groups.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" }
    });
  }

  async findPermissionByName(name: string, tx: Prisma.TransactionClient = prisma) {
    return tx.permissions.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deleted_at: null }
    });
  }

  async createPermission(
    tenantId: string | null,
    name: string,
    description: string | null,
    categoryId: string | null = null,
    groupId: string | null = null,
    createdBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.permissions.create({
      data: {
        tenant_id: tenantId,
        name,
        description,
        category_id: categoryId,
        group_id: groupId,
        created_by: createdBy,
        updated_by: createdBy
      }
    });
  }

  // --- Role Permissions Repositories ---
  async findRolePermissions(tenantId: string, roleId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.role_permissions.findMany({
      where: { tenant_id: tenantId, role_id: roleId, deleted_at: null },
      include: { permissions: true }
    });
  }

  async setRolePermissions(
    tenantId: string,
    roleId: string,
    permissionIds: string[],
    createdBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    // Delete existing
    await tx.role_permissions.deleteMany({
      where: { tenant_id: tenantId, role_id: roleId }
    });

    if (permissionIds.length === 0) return [];

    // Create new
    return tx.role_permissions.createMany({
      data: permissionIds.map((pId) => ({
        tenant_id: tenantId,
        role_id: roleId,
        permission_id: pId,
        is_deny: false,
        created_by: createdBy,
        updated_by: createdBy
      }))
    });
  }

  async setRolePermissionsExplicit(
    tenantId: string,
    roleId: string,
    mappings: { permissionId: string; isDeny: boolean }[],
    createdBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    await tx.role_permissions.deleteMany({
      where: { tenant_id: tenantId, role_id: roleId }
    });

    if (mappings.length === 0) return;

    await tx.role_permissions.createMany({
      data: mappings.map((m) => ({
        tenant_id: tenantId,
        role_id: roleId,
        permission_id: m.permissionId,
        is_deny: m.isDeny,
        created_by: createdBy,
        updated_by: createdBy
      }))
    });
  }

  // --- User Roles Repositories ---
  async findUserRoles(tenantId: string, profileId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.user_roles.findMany({
      where: { tenant_id: tenantId, profile_id: profileId, deleted_at: null },
      include: { roles: true }
    });
  }

  async setUserRoles(
    tenantId: string,
    profileId: string,
    roleIds: string[],
    createdBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    await tx.user_roles.deleteMany({
      where: { tenant_id: tenantId, profile_id: profileId }
    });

    if (roleIds.length === 0) return [];

    return tx.user_roles.createMany({
      data: roleIds.map((rId) => ({
        tenant_id: tenantId,
        profile_id: profileId,
        role_id: rId,
        created_by: createdBy,
        updated_by: createdBy
      }))
    });
  }

  // --- User Direct / Custom Permissions Repositories ---
  async findUserPermissions(tenantId: string, profileId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.user_permissions.findMany({
      where: { tenant_id: tenantId, profile_id: profileId, deleted_at: null },
      include: { permissions: true }
    });
  }

  async setUserPermissionOverride(
    tenantId: string,
    profileId: string,
    permissionId: string,
    isDeny: boolean,
    expiresAt: Date | null = null,
    createdBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.user_permissions.upsert({
      where: {
        tenant_id_profile_id_permission_id: {
          tenant_id: tenantId,
          profile_id: profileId,
          permission_id: permissionId
        }
      },
      update: {
        is_deny: isDeny,
        expires_at: expiresAt,
        deleted_at: null,
        is_active: true,
        updated_by: createdBy
      },
      create: {
        tenant_id: tenantId,
        profile_id: profileId,
        permission_id: permissionId,
        is_deny: isDeny,
        expires_at: expiresAt,
        created_by: createdBy,
        updated_by: createdBy
      }
    });
  }

  async removeUserPermissionOverride(
    tenantId: string,
    profileId: string,
    permissionId: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.user_permissions.deleteMany({
      where: { tenant_id: tenantId, profile_id: profileId, permission_id: permissionId }
    });
  }

  // --- Tenant Permission Constraints Repositories ---
  async findTenantPermissions(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.tenant_permissions.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      include: { permissions: true }
    });
  }

  // --- Role Hierarchy Repositories ---
  async findRoleHierarchy(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.role_hierarchy.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      include: {
        parent_role: true,
        child_role: true
      }
    });
  }

  async addRoleHierarchyLink(
    tenantId: string,
    parentRoleId: string,
    childRoleId: string,
    createdBy: string | null = null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.role_hierarchy.upsert({
      where: {
        tenant_id_parent_role_id_child_role_id: {
          tenant_id: tenantId,
          parent_role_id: parentRoleId,
          child_role_id: childRoleId
        }
      },
      update: {
        deleted_at: null,
        is_active: true,
        updated_by: createdBy
      },
      create: {
        tenant_id: tenantId,
        parent_role_id: parentRoleId,
        child_role_id: childRoleId,
        created_by: createdBy,
        updated_by: createdBy
      }
    });
  }

  async removeRoleHierarchyLink(
    tenantId: string,
    parentRoleId: string,
    childRoleId: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.role_hierarchy.deleteMany({
      where: { tenant_id: tenantId, parent_role_id: parentRoleId, child_role_id: childRoleId }
    });
  }

  // --- Audit Logging ---
  async createAuditLog(
    tenantId: string,
    action: string,
    actorId: string | null,
    actorEmail: string | null,
    entityType: string | null,
    entityId: string | null,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null,
    ipAddress: string | null,
    userAgent: string | null,
    device: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.audit_logs.create({
      data: {
        tenant_id: tenantId,
        action,
        actor_id: actorId,
        actor_email: actorEmail,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues as Prisma.InputJsonValue,
        new_values: newValues as Prisma.InputJsonValue,
        ip_address: ipAddress,
        user_agent: userAgent,
        device
      }
    });
  }

  async findAuditLogs(
    tenantId: string,
    query: AuditLogsQuery,
    tx: Prisma.TransactionClient = prisma
  ) {
    const { page, limit, action, actorEmail, entityType, entityId, search } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.audit_logsWhereInput = {
      tenant_id: tenantId,
      deleted_at: null
    };

    if (action) {
      whereClause.action = { contains: action, mode: "insensitive" };
    }
    if (actorEmail) {
      whereClause.actor_email = { contains: actorEmail, mode: "insensitive" };
    }
    if (entityType) {
      whereClause.entity_type = { equals: entityType };
    }
    if (entityId) {
      whereClause.entity_id = { equals: entityId };
    }
    if (search) {
      whereClause.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { actor_email: { contains: search, mode: "insensitive" } },
        { entity_type: { contains: search, mode: "insensitive" } }
      ];
    }

    return tx.audit_logs.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      skip,
      take: limit
    });
  }

  async countAuditLogs(
    tenantId: string,
    query: AuditLogsQuery,
    tx: Prisma.TransactionClient = prisma
  ) {
    const { action, actorEmail, entityType, entityId, search } = query;

    const whereClause: Prisma.audit_logsWhereInput = {
      tenant_id: tenantId,
      deleted_at: null
    };

    if (action) {
      whereClause.action = { contains: action, mode: "insensitive" };
    }
    if (actorEmail) {
      whereClause.actor_email = { contains: actorEmail, mode: "insensitive" };
    }
    if (entityType) {
      whereClause.entity_type = { equals: entityType };
    }
    if (entityId) {
      whereClause.entity_id = { equals: entityId };
    }
    if (search) {
      whereClause.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { actor_email: { contains: search, mode: "insensitive" } },
        { entity_type: { contains: search, mode: "insensitive" } }
      ];
    }

    return tx.audit_logs.count({
      where: whereClause
    });
  }
}
