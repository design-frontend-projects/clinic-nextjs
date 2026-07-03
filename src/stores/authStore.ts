import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

interface AuthState {
  /** Current Supabase session */
  session: Session | null;
  /** Set the session (called after sign‑in or sign‑out) */
  setSession: (session: Session | null) => void;
  /** Convenient getters */
  getUserId: () => string | null;
  getEmail: () => string | null;
  getRoles: () => string[];
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),
  getUserId: () => get().session?.user?.id ?? null,
  getEmail: () => get().session?.user?.email ?? null,
  getRoles: () => {
    const meta = get().session?.user?.app_metadata as unknown as { roles?: unknown };
    const roles = meta?.roles;
    return Array.isArray(roles) && roles.every(r => typeof r === "string")
      ? (roles as string[])
      : [];
  },
  isAuthenticated: () => !!get().session,
}));
