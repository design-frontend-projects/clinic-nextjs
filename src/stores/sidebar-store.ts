import { create } from "zustand";

interface SidebarState {
  /** Desktop rail expanded (w-64) vs collapsed (w-16). */
  isOpen: boolean;
  /** Mobile drawer visibility (below lg breakpoint). */
  isMobileOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  isMobileOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setMobileOpen: (open) => set({ isMobileOpen: open }),
}));
