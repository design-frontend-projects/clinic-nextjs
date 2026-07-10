import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getSupabaseSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Validates that the current user is an App Owner.
 * If not authenticated or not an App Owner, redirects.
 */
export async function requireAppOwner() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }

  const profile = await prisma.profiles.findUnique({
    where: { auth_user_id: session.user.id },
    select: {
      id: true,
      role: true,
      full_name: true,
      email: true,
    },
  });

  if (!profile || (profile.role !== "app_owner" && profile.role !== 'owner')) {
    // If they have a profile but they are not an app_owner, redirect to standard dashboard or home
    return redirect({ href: "/", locale: await getLocale() });
  }

  return profile;
}

/**
 * Returns true if the current user is an App Owner, false otherwise.
 */
export async function isAppOwner() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return false;

  const profile = await prisma.profiles.findUnique({
    where: { auth_user_id: session.user.id },
    select: { role: true },
  });

  return profile?.role === "app_owner";
}
