import { EvaluationService } from "@/features/rbac/services/evaluation.service";
import { requireTenantInfo } from "./auth";

const evaluationService = new EvaluationService();

/**
 * Checks if the currently authenticated user has the specified permission.
 * Throws an error if they don't.
 */
export async function requirePermission(permissionName: string) {
  const tenant = await requireTenantInfo();
  
  // Admins bypass permission checks
  if (tenant.role === "admin") {
    return true;
  }

  const result = await evaluationService.evaluatePermission(
    tenant.clinicId,
    tenant.profileId,
    permissionName
  );

  if (!result.allowed) {
    throw new Error(`Forbidden: ${result.reason || "Missing required permission"}`);
  }

  return true;
}

/**
 * Checks if the currently authenticated user has the specified permission
 * without throwing an error, returning a boolean.
 */
export async function hasPermission(permissionName: string) {
  try {
    const tenant = await requireTenantInfo();
    
    if (tenant.role === "admin") {
      return true;
    }

    const result = await evaluationService.evaluatePermission(
      tenant.clinicId,
      tenant.profileId,
      permissionName
    );

    return result.allowed;
  } catch (error) {
    return false;
  }
}
