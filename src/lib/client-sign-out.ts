"use client";

import type { QueryClient } from "@tanstack/react-query";
import { createSupabaseClient } from "@/lib/supabase/client";
import { clearSignOutCookies } from "@/app/actions/auth";
import { useAuthStore } from "@/stores/authStore";

/**
 * Shared client-side sign-out flow:
 * 1. Closes any open RxDB instance (preserving per-user IndexedDB on disk).
 * 2. Signs out of Supabase Auth.
 * 3. Resets Zustand auth state and TanStack Query cache so a subsequent user
 *    never sees stale tenant/dashboard data.
 * 4. Clears server-side onboarding/clinic/branch cookies (best-effort).
 */
export async function performClientSignOut(
  queryClient: QueryClient,
): Promise<void> {
  try {
    const { destroyOfflineDb } = await import("@/lib/offline/db");
    await destroyOfflineDb();
  } catch {
    // Non-fatal: continue signing out even if offline DB wasn't initialized.
  }

  const supabase = createSupabaseClient();
  await supabase.auth.signOut();

  useAuthStore.getState().setSession(null);
  queryClient.clear();

  try {
    await clearSignOutCookies();
  } catch {
    // Non-fatal when offline.
  }
}
