import type { StateCreator } from "zustand";
import type { SidebarSection } from "../types";

export interface SidebarSlice {
  sidebarCollapsed: boolean;
  sidebarActiveSection: SidebarSection | null;

  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarActiveSection: (section: SidebarSection | null) => void;
}

export const createSidebarSlice: StateCreator<SidebarSlice, [["zustand/immer", never]]> = (set) => ({
  sidebarCollapsed: false,
  sidebarActiveSection: null,

  toggleSidebarCollapsed: () =>
    set((state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    }),

  setSidebarCollapsed: (collapsed) =>
    set((state) => {
      state.sidebarCollapsed = collapsed;
    }),

  setSidebarActiveSection: (section) =>
    set((state) => {
      state.sidebarActiveSection = section;
    }),
});
