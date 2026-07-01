// src/features/rbac/domain/dtos.ts
import { z } from "zod";

// Regular expression to match permission naming convention: module.action or module.submodule.action
// e.g. patient.read, inventory.stock.transfer
export const PERMISSION_NAME_REGEX = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;

export const RESERVED_ROLE_NAMES = [
  "super admin",
  "superadmin",
  "tenant owner",
  "owner",
  "administrator",
  "admin"
];

// Role validation schemas
export const RoleCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must be at most 50 characters")
    .refine(
      (val) => !RESERVED_ROLE_NAMES.includes(val.toLowerCase().trim()),
      {
        message: "This role name is reserved by the system"
      }
    ),
  description: z.string().max(255, "Description is too long").optional().nullable(),
  is_active: z.boolean().default(true),
  permissionIds: z.array(z.string().uuid()).default([]),
  parentRoleId: z.string().uuid().optional().nullable()
});

export type RoleCreateInput = z.input<typeof RoleCreateSchema>;

export const RoleUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must be at most 50 characters"),
  description: z.string().max(255, "Description is too long").optional().nullable(),
  is_active: z.boolean().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
  parentRoleId: z.string().uuid().optional().nullable()
});

export type RoleUpdateInput = z.input<typeof RoleUpdateSchema>;

// Permission validation schemas
export const PermissionCreateSchema = z.object({
  name: z
    .string()
    .min(3, "Permission name is too short")
    .max(100, "Permission name is too long")
    .regex(
      PERMISSION_NAME_REGEX,
      "Permission must follow the naming convention (e.g. 'patient.read' or 'inventory.stock.transfer')"
    ),
  description: z.string().max(255, "Description is too long").optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable()
});

export type PermissionCreateInput = z.input<typeof PermissionCreateSchema>;

// User Role assignment validation
export const UserRoleAssignSchema = z.object({
  profileId: z.string().uuid(),
  roleIds: z.array(z.string().uuid())
});

export type UserRoleAssignInput = z.input<typeof UserRoleAssignSchema>;

// Direct / Temporary permission override validation
export const UserPermissionOverrideSchema = z.object({
  profileId: z.string().uuid(),
  permissionId: z.string().uuid(),
  is_deny: z.boolean().default(false),
  expires_at: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null))
});

export type UserPermissionOverrideInput = z.input<typeof UserPermissionOverrideSchema>;

// Role Hierarchy link validation
export const RoleHierarchyLinkSchema = z.object({
  parentRoleId: z.string().uuid(),
  childRoleId: z.string().uuid()
});

export type RoleHierarchyLinkInput = z.input<typeof RoleHierarchyLinkSchema>;

// Audit Logs query schema
export const AuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional().nullable(),
  actorEmail: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  search: z.string().optional().nullable()
});

export type AuditLogsQueryInput = z.input<typeof AuditLogsQuerySchema>;
export type AuditLogsQuery = z.infer<typeof AuditLogsQuerySchema>;
