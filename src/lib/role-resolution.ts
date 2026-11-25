export type UserRoleRelation = {
  is_active?: boolean;
  deleted_at?: Date | null;
  tenant_id?: string | null;
  roles?: {
    name?: string | null;
    is_active?: boolean;
    deleted_at?: Date | null;
  } | null;
};

/**
 * Returns true when an RBAC `roles.name` value represents the platform
 * `app_owner` role (case- and separator-insensitive).
 */
export function isAppOwnerRoleName(name: string | null | undefined): boolean {
  return Boolean(
    name &&
      name
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_") === "app_owner",
  );
}

/**
 * Extract active, non-deleted role names from a `profiles.user_roles` relation
 * array. Safely tolerates undefined or partial mock data.
 */
export function extractActiveRbacRoleNames(
  userRoles?: UserRoleRelation[] | null,
): string[] {
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return [];
  }

  const names: string[] = [];
  for (const ur of userRoles) {
    if (
      ur &&
      ur.is_active !== false &&
      !ur.deleted_at &&
      ur.roles &&
      ur.roles.is_active !== false &&
      !ur.roles.deleted_at &&
      typeof ur.roles.name === "string"
    ) {
      names.push(ur.roles.name);
    }
  }
  return names;
}

/**
 * Resolve the canonical profile role from `profiles.role` plus any active
 * `user_roles -> roles.name` fallback assignments.
 */
export function resolveEffectiveProfileRole(
  profileRole: string | null | undefined,
  activeRbacRoleNames: string[] = [],
): string {
  if (
    profileRole === "app_owner" ||
    activeRbacRoleNames.some((name) => isAppOwnerRoleName(name))
  ) {
    return "app_owner";
  }
  return profileRole ?? "";
}

/**
 * Only clinic owners (or profiles with no assigned role yet) may enter or run
 * the clinic onboarding wizard. Platform `app_owner` and all non-owner clinic
 * roles skip onboarding.
 */
export function canRunClinicOnboarding(
  role: string | null | undefined,
): boolean {
  return !role || role === "owner";
}
