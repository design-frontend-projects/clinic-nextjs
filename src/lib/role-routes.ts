import type { ProfileRole } from "@prisma/client";

/**
 * Single source of truth mapping a user's canonical `profiles.role` to the
 * dashboard route they land on after sign-in (and the "go to dashboard" link on
 * the landing page). Keep this aligned with the per-area layout guards under
 * `src/app/[locale]/(dashboard)/*` — a role must land on a route whose guard
 * admits it, or it will be bounced.
 *
 * Route notes:
 * - `owner`/`super_admin` share the clinic `/admin` dashboard (both are
 *   tenant super-users; the admin layout guard admits them).
 * - `receptionist` shares the `/staff` area (the staff layout guard admits it).
 * - `pharmacist` lands on `/pharmacy`, whose index redirects to
 *   `/pharmacy/dispensing`.
 */
const ROLE_HOME_PATHS: Record<ProfileRole, string> = {
  owner: "/admin",
  admin: "/admin",
  super_admin: "/admin",
  app_owner: "/app-owner",
  doctor: "/doctor",
  staff: "/staff",
  receptionist: "/staff",
  pharmacist: "/pharmacy",
  patient: "/patient",
};

/** Fallback landing when the role is unknown/unset (mirrors legacy behavior). */
export const DEFAULT_HOME_PATH = "/admin";

/**
 * Resolve the dashboard landing path for a role string. Unknown or empty roles
 * fall back to {@link DEFAULT_HOME_PATH}.
 */
export function roleHomePath(role: string | null | undefined): string {
  if (role && role in ROLE_HOME_PATHS) {
    return ROLE_HOME_PATHS[role as ProfileRole];
  }
  return DEFAULT_HOME_PATH;
}
