// src/features/rbac/services/evaluation.service.ts
import { RBACRepository } from "../repositories/rbac.repository";
import { cacheService } from "./cache.service";
import { PermissionEvaluationResult } from "../domain/models";

export class EvaluationService {
  constructor(private repo: RBACRepository = new RBACRepository()) {}

  // Helper to match wildcards and module management permissions
  // e.g. "patient.manage" allows "patient.create", "patient.read" etc.
  // "manage" allows any permission.
  private matchPermission(assigned: string, required: string): boolean {
    if (assigned === "*" || assigned === "manage") return true;
    if (assigned === required) return true;

    // Check module management (e.g. "patient.manage" matches "patient.read")
    if (assigned.endsWith(".manage")) {
      const assignedModule = assigned.substring(0, assigned.length - 7);
      if (required.startsWith(assignedModule + ".")) {
        return true;
      }
    }

    // Check wildcard suffix (e.g. "patient.*" matches "patient.read")
    if (assigned.endsWith(".*")) {
      const assignedModule = assigned.substring(0, assigned.length - 2);
      if (required.startsWith(assignedModule + ".")) {
        return true;
      }
    }

    return false;
  }

  // DFS Traversal to find all child roles (inherited roles) for a list of starting role IDs
  private async getInheritedRoles(tenantId: string, directRoleIds: string[]): Promise<string[]> {
    // Check cache first
    const cachedHierarchy = await cacheService.getRoleHierarchy(tenantId);
    let hierarchy: { parent_role_id: string; child_role_id: string }[] = [];

    if (cachedHierarchy) {
      hierarchy = cachedHierarchy;
    } else {
      hierarchy = await this.repo.findRoleHierarchy(tenantId);
      await cacheService.setRoleHierarchy(tenantId, hierarchy);
    }

    // Map parents to child roles
    const parentToChildren = new Map<string, string[]>();
    for (const link of hierarchy) {
      const list = parentToChildren.get(link.parent_role_id) || [];
      list.push(link.child_role_id);
      parentToChildren.set(link.parent_role_id, list);
    }

    const visited = new Set<string>();
    const queue = [...directRoleIds];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        const children = parentToChildren.get(current) || [];
        for (const child of children) {
          if (!visited.has(child)) {
            queue.push(child);
          }
        }
      }
    }

    return Array.from(visited);
  }

  async evaluatePermission(
    tenantId: string,
    profileId: string,
    permissionName: string
  ): Promise<PermissionEvaluationResult> {
    // 0. Verify if Tenant has this permission (Tenant Permission Restriction)
    // If tenant permissions are configured, they act as a whitelist.
    const tenantPerms = await this.repo.findTenantPermissions(tenantId);
    if (tenantPerms.length > 0) {
      const hasTenantPerm = tenantPerms.some((tp) => 
        tp.permissions && this.matchPermission(tp.permissions.name, permissionName)
      );
      if (!hasTenantPerm) {
        return {
          allowed: false,
          evaluatedBy: "DEFAULT",
          reason: `Tenant subscription does not support permission: ${permissionName}`
        };
      }
    }

    // 1. Fetch User Custom Direct / Temporary Overrides
    const directOverrides = await this.repo.findUserPermissions(tenantId, profileId);
    const now = new Date();

    // Check for direct EXPLICIT DENY (highest priority)
    const directDeny = directOverrides.find((o) => 
      o.is_deny && 
      o.permissions && 
      this.matchPermission(o.permissions.name, permissionName) &&
      (!o.expires_at || o.expires_at > now)
    );

    if (directDeny) {
      return {
        allowed: false,
        evaluatedBy: "EXPLICIT_DENY",
        reason: "Explicit direct deny override set on user profile",
        expiresAt: directDeny.expires_at
      };
    }

    // 2. Fetch User Roles and Inherited Roles
    const userRoles = await this.repo.findUserRoles(tenantId, profileId);
    const directRoleIds = userRoles.map((ur) => ur.role_id);
    
    // DFS traversal to fetch inherited roles
    const allRoleIds = await this.getInheritedRoles(tenantId, directRoleIds);

    // 3. Check for Role-level EXPLICIT DENY
    // If any role assigned (or inherited) explicitly denies the permission, block it.
    for (const roleId of allRoleIds) {
      const rolePerms = await this.repo.findRolePermissions(tenantId, roleId);
      const roleDeny = rolePerms.find((rp) => 
        rp.is_deny && 
        rp.permissions && 
        this.matchPermission(rp.permissions.name, permissionName)
      );
      if (roleDeny) {
        return {
          allowed: false,
          evaluatedBy: "EXPLICIT_DENY",
          reason: `Explicit deny override set on role: ${roleId}`,
          roleId
        };
      }
    }

    // 4. Check for direct EXPLICIT ALLOW
    const directAllow = directOverrides.find((o) => 
      !o.is_deny && 
      o.permissions && 
      this.matchPermission(o.permissions.name, permissionName) &&
      (!o.expires_at || o.expires_at > now)
    );

    if (directAllow) {
      return {
        allowed: true,
        evaluatedBy: "EXPLICIT_ALLOW",
        reason: "Explicit direct allow override set on user profile",
        expiresAt: directAllow.expires_at
      };
    }

    // 5. Check for Role-level EXPLICIT ALLOW (Inherited or Direct)
    for (const roleId of allRoleIds) {
      const rolePerms = await this.repo.findRolePermissions(tenantId, roleId);
      const roleAllow = rolePerms.find((rp) => 
        !rp.is_deny && 
        rp.permissions && 
        this.matchPermission(rp.permissions.name, permissionName)
      );
      if (roleAllow) {
        const isDirectRole = directRoleIds.includes(roleId);
        return {
          allowed: true,
          evaluatedBy: isDirectRole ? "EXPLICIT_ALLOW" : "INHERITED",
          reason: isDirectRole 
            ? `Permission allowed directly via Role: ${roleId}` 
            : `Permission inherited via Role Hierarchy from Role: ${roleId}`,
          roleId,
          inheritedFromRoleId: isDirectRole ? undefined : roleId
        };
      }
    }

    // 6. Default Deny Fallback
    return {
      allowed: false,
      evaluatedBy: "DEFAULT",
      reason: "No matching allow permission overrides found (Default Deny)"
    };
  }

  // Pre-fetch and cache all user permissions for fast evaluation
  async getUserActivePermissions(tenantId: string, profileId: string): Promise<string[]> {
    const cached = await cacheService.getUserPermissions(tenantId, profileId);
    if (cached) return cached;

    // Fetch all permissions in system
    const allSystemPerms = await this.repo.findPermissions();
    const activePerms: string[] = [];

    // Evaluate each permission
    for (const perm of allSystemPerms) {
      const result = await this.evaluatePermission(tenantId, profileId, perm.name);
      if (result.allowed) {
        activePerms.push(perm.name);
      }
    }

    await cacheService.setUserPermissions(tenantId, profileId, activePerms);
    return activePerms;
  }
}
export const evaluationService = new EvaluationService();
