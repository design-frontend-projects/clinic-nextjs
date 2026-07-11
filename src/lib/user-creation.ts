import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ProfileRole } from "@prisma/client";
import type { InvitableProfileRole } from "@/types/clinic.types";

/**
 * Generate a strong temporary password guaranteeing at least one upper, lower,
 * digit and symbol (satisfies Supabase's default password policy). Ambiguous
 * characters (0/O, 1/l/I) are omitted so it can be read aloud / copied reliably.
 */
export function generateTempPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const pick = (set: string): string => set[randomInt(0, set.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) {
    chars.push(pick(all));
  }

  // Fisher-Yates shuffle so the guaranteed classes are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

/**
 * Shared helpers for the tenant user-creation flows (doctor / staff / patient):
 * clinic-scoped duplicate detection and mapping a selected RBAC role name to the
 * legacy `profiles.role` enum (still read by auth/layout routing and the RBAC
 * bypass check in `src/lib/rbac.ts`).
 */

export interface DuplicateMatch {
  field: "email" | "phone";
  source: "profiles" | "patients";
}

type ContactOr = { email?: { equals: string; mode: "insensitive" }; phone?: string };

/** Build the OR filter for the provided contact fields (only non-empty ones). */
function buildContactOr(email: string | null, phone: string | null): ContactOr[] {
  const or: ContactOr[] = [];
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });
  if (phone) or.push({ phone });
  return or;
}

/**
 * Check whether a person with the given email or phone already exists in the
 * clinic, across both `profiles` and `patients`. Returns the first match (which
 * field / which table) or `null`. Matching is scoped to `clinicId` only.
 */
export async function findClinicDuplicate({
  clinicId,
  email,
  phone,
  excludePatientId,
}: {
  clinicId: string;
  email?: string | null;
  phone?: string | null;
  excludePatientId?: string;
}): Promise<DuplicateMatch | null> {
  const normEmail = email?.trim().toLowerCase() || null;
  const normPhone = phone?.trim() || null;
  if (!normEmail && !normPhone) return null;

  const or = buildContactOr(normEmail, normPhone);

  const profileMatch = await prisma.profiles.findFirst({
    where: { tenant_id: clinicId, OR: or },
    select: { email: true, phone: true },
  });
  if (profileMatch) {
    const emailHit = !!normEmail && profileMatch.email?.trim().toLowerCase() === normEmail;
    return { field: emailHit ? "email" : "phone", source: "profiles" };
  }

  const patientMatch = await prisma.patients.findFirst({
    where: {
      clinic_id: clinicId,
      OR: or,
      ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
    },
    select: { email: true, phone: true },
  });
  if (patientMatch) {
    const emailHit = !!normEmail && patientMatch.email?.trim().toLowerCase() === normEmail;
    return { field: emailHit ? "email" : "phone", source: "patients" };
  }

  return null;
}

/** Human-readable error message for a duplicate match. */
export function duplicateMessage(match: DuplicateMatch): string {
  const who = match.source === "patients" ? "patient" : "user";
  return `A ${who} with this ${match.field} already exists in this clinic.`;
}

/**
 * Map a seeded RBAC role name (e.g. "Doctor", "Administrator") to the legacy
 * `profiles.role` enum. `Doctor` -> doctor; owner/admin-tier -> admin (RBAC
 * bypass); everything else -> staff. Patients are handled outside this mapping.
 */
export function roleNameToProfileRole(roleName: string | null | undefined): ProfileRole {
  const name = (roleName || "").trim().toLowerCase();
  if (name === "doctor") return "doctor";
  if (name === "administrator" || name === "tenant owner" || name === "super admin") {
    return "admin";
  }
  return "staff";
}

/**
 * Candidate seeded RBAC role names (lowercase) for each invitable profile role,
 * in preference order — first match against the tenant's roles wins.
 */
const PROFILE_ROLE_TO_RBAC_NAMES: Record<InvitableProfileRole, string[]> = {
  doctor: ["doctor"],
  admin: ["administrator", "tenant owner"],
  staff: ["staff"],
  pharmacist: ["pharmacist", "staff"],
  receptionist: ["receptionist", "staff"],
};

/**
 * Find the tenant RBAC role matching a selected profile role, so the invite
 * flow can assign permissions. Returns `null` when the tenant has no matching
 * role (e.g. RBAC seeding was skipped) — callers should then skip assignment.
 */
export function findRbacRoleForProfileRole<T extends { id: string; name: string }>(
  roles: readonly T[],
  profileRole: InvitableProfileRole,
): T | null {
  const candidates = PROFILE_ROLE_TO_RBAC_NAMES[profileRole];
  for (const candidate of candidates) {
    const match = roles.find((r) => r.name.trim().toLowerCase() === candidate);
    if (match) return match;
  }
  return null;
}
