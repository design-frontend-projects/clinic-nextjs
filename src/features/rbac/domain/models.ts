// src/features/rbac/domain/models.ts

export interface BaseEntity {
  id: string;
  tenant_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface PermissionCategory extends BaseEntity {
  name: string;
  description: string | null;
}

export interface PermissionGroup extends BaseEntity {
  name: string;
  description: string | null;
}

export interface Permission extends BaseEntity {
  name: string;
  description: string | null;
  category_id: string | null;
  group_id: string | null;
}

export interface Role extends BaseEntity {
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface UserRole extends BaseEntity {
  tenant_id: string;
  profile_id: string;
  role_id: string;
}

export interface RolePermission extends BaseEntity {
  tenant_id: string;
  role_id: string;
  permission_id: string;
  is_deny: boolean;
}

export interface UserPermission extends BaseEntity {
  tenant_id: string;
  profile_id: string;
  permission_id: string;
  is_deny: boolean;
  expires_at: Date | null;
}

export interface TenantPermission extends BaseEntity {
  tenant_id: string;
  permission_id: string;
}

export interface TenantRole extends BaseEntity {
  tenant_id: string;
  role_id: string;
}

export interface RoleHierarchy extends BaseEntity {
  tenant_id: string;
  parent_role_id: string;
  child_role_id: string;
}

export interface RoleGroup extends BaseEntity {
  tenant_id: string;
  name: string;
  description: string | null;
}

export interface RoleGroupRole extends BaseEntity {
  tenant_id: string;
  role_group_id: string;
  role_id: string;
}

export interface AuditLog extends BaseEntity {
  tenant_id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  device: string | null;
}

export type PermissionEvaluationOrder = 'EXPLICIT_DENY' | 'EXPLICIT_ALLOW' | 'INHERITED' | 'DEFAULT';

export interface PermissionEvaluationResult {
  allowed: boolean;
  evaluatedBy: PermissionEvaluationOrder;
  reason: string;
  roleId?: string;
  inheritedFromRoleId?: string;
  expiresAt?: Date | null;
}
