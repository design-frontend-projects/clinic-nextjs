// src/features/rbac/middleware.ts
import { requireTenantInfo, requireAuthenticatedTenant } from "@/lib/auth";
import { evaluationService } from "./services/evaluation.service";
import { rbacService } from "./services/rbac.service";
import { cacheService } from "./services/cache.service";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized access") {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Access Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Resource conflict occurred") {
    super(409, message);
  }
}

export class ValidationError extends HttpError {
  constructor(message = "Validation failed") {
    super(422, message);
  }
}

export async function requireTenant() {
  return requireTenantInfo();
}

export async function requireAuthenticated() {
  return requireAuthenticatedTenant();
}

export async function requirePermission(permission: string) {
  const tenant = await requireTenant();

  // Super Admin role bypasses all checks
  if (tenant.role === "Super Admin") return tenant;

  const allowed = await cacheService.dedupedPermissionCheck(
    async (tId, pId, perm) => {
      const res = await evaluationService.evaluatePermission(tId, pId, perm);
      return res.allowed;
    },
    tenant.clinicId,
    tenant.profileId,
    permission
  );

  if (!allowed) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }

  return tenant;
}

export async function requireAnyPermission(permissions: string[]) {
  const tenant = await requireTenant();

  if (tenant.role === "Super Admin") return tenant;

  for (const permission of permissions) {
    const allowed = await cacheService.dedupedPermissionCheck(
      async (tId, pId, perm) => {
        const res = await evaluationService.evaluatePermission(tId, pId, perm);
        return res.allowed;
      },
      tenant.clinicId,
      tenant.profileId,
      permission
    );
    if (allowed) return tenant;
  }

  throw new ForbiddenError(`Missing at least one required permission: ${permissions.join(", ")}`);
}

export async function requireAllPermissions(permissions: string[]) {
  const tenant = await requireTenant();

  if (tenant.role === "Super Admin") return tenant;

  for (const permission of permissions) {
    const allowed = await cacheService.dedupedPermissionCheck(
      async (tId, pId, perm) => {
        const res = await evaluationService.evaluatePermission(tId, pId, perm);
        return res.allowed;
      },
      tenant.clinicId,
      tenant.profileId,
      permission
    );
    if (!allowed) {
      throw new ForbiddenError(`Missing required permission: ${permission}`);
    }
  }

  return tenant;
}

export async function requireRole(roleName: string) {
  const tenant = await requireTenant();

  if (tenant.role === "Super Admin") return tenant;

  const userRoles = await rbacService.getUserRoles(tenant.clinicId, tenant.profileId);
  const hasRole = userRoles.some(
    (ur) => ur.roles.name.toLowerCase() === roleName.toLowerCase()
  );

  if (!hasRole) {
    throw new ForbiddenError(`Missing required role: ${roleName}`);
  }

  return tenant;
}

export async function requireOwner() {
  const tenant = await requireTenant();
  if (tenant.role === "Tenant Owner" || tenant.role === "Super Admin") {
    return tenant;
  }
  throw new ForbiddenError("Only the tenant owner can perform this action");
}

export async function requireSuperAdmin() {
  const tenant = await requireTenant();
  if (tenant.role === "Super Admin") {
    return tenant;
  }
  throw new ForbiddenError("Only a Super Admin can perform this action");
}
