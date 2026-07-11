import { create } from "zustand";

interface OnlineState {
  /** Whether the browser currently has a network connection. */
  isOnline: boolean;
  /** Whether any collection is actively replicating right now. */
  isSyncing: boolean;
  /** Number of local writes not yet acknowledged by the server. */
  pendingCount: number;
  /** Last replication error message (for diagnostics; not auto-toasted). */
  lastSyncError: string | null;
  setOnline: (value: boolean) => void;
  setSyncing: (value: boolean) => void;
  setPendingCount: (count: number) => void;
  setSyncError: (message: string | null) => void;
}

// isOnline defaults to true so SSR/first paint doesn't flash the offline banner;
// OnlineProvider corrects it from navigator.onLine on mount.
export const useOnlineStore = create<OnlineState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncError: null,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncError: (lastSyncError) => set({ lastSyncError }),
}));
