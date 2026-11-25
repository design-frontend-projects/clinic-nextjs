import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getSupabaseSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  extractActiveRbacRoleNames,
  resolveEffectiveProfileRole,
} from "@/lib/role-resolution";
import { roleHomePath } from "@/lib/role-routes";

async function loadProfileWithRoles(userId: string) {
  return prisma.profiles.findUnique({
    where: { auth_user_id: userId },
    select: {
      id: true,
      role: true,
      full_name: true,
      email: true,
      status: true,
      user_roles: {
        where: { is_active: true, deleted_at: null },
        select: {
          roles: {
            select: {
              name: true,
              is_active: true,
              deleted_at: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Validates that the current user is an active App Owner (via `profiles.role`
 * or an active `user_roles -> roles.name` assignment).
 * Redirects unauthenticated or blocked users to `/sign-in`, and non-app-owner
 * users to their role dashboard.
 */
export async function requireAppOwner() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  const profile = await loadProfileWithRoles(session.user.id);
  if (!profile || profile.status === "blocked") {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  const effectiveRole = resolveEffectiveProfileRole(
    profile.role,
    extractActiveRbacRoleNames(profile.user_roles),
  );

  if (effectiveRole !== "app_owner") {
    return redirect({
      href: effectiveRole ? roleHomePath(effectiveRole) : "/",
      locale: await getLocale(),
    });
  }

  return {
    id: profile.id,
    role: "app_owner" as const,
    full_name: profile.full_name,
    email: profile.email,
    status: profile.status,
  };
}

/**
 * Returns true if the current user is a non-blocked App Owner, false otherwise.
 */
export async function isAppOwner() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return false;

  const profile = await loadProfileWithRoles(session.user.id);
  if (!profile || profile.status === "blocked") return false;

  const effectiveRole = resolveEffectiveProfileRole(
    profile.role,
    extractActiveRbacRoleNames(profile.user_roles),
  );

  return effectiveRole === "app_owner";
}
