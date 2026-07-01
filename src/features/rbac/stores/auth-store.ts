// src/features/rbac/stores/auth-store.ts
import { create } from "zustand";

interface AuthState {
  user: { id: string; email: string | null; fullName: string | null } | null;
  tenant: { clinicId: string; name: string } | null;
  roles: string[];
  permissions: string[];
  isLoading: boolean;
  setAuthData: (data: {
    user: AuthState["user"];
    tenant: AuthState["tenant"];
    roles: string[];
    permissions: string[];
  }) => void;
  clearAuthData: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  roles: [],
  permissions: [],
  isLoading: true,
  setAuthData: (data) => set({ ...data, isLoading: false }),
  clearAuthData: () =>
    set({ user: null, tenant: null, roles: [], permissions: [], isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
export default useAuthStore;
