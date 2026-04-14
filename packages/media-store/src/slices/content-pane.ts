import type { StateCreator } from "zustand";
import type { ViewMode } from "../types";

export interface ContentPaneSlice {
  viewMode: ViewMode;
  selectedItemIds: Set<string>;
  isMultiSelectActive: boolean;

  setViewMode: (mode: ViewMode) => void;
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleItemSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setMultiSelect: (active: boolean) => void;
}

export const createContentPaneSlice: StateCreator<ContentPaneSlice, [["zustand/immer", never]]> = (set) => ({
  viewMode: "grid",
  selectedItemIds: new Set<string>(),
  isMultiSelectActive: false,

  setViewMode: (mode) =>
    set((state) => {
      state.viewMode = mode;
    }),

  selectItem: (id) =>
    set((state) => {
      state.selectedItemIds.add(id);
    }),

  deselectItem: (id) =>
    set((state) => {
      state.selectedItemIds.delete(id);
    }),

  toggleItemSelection: (id) =>
    set((state) => {
      if (state.selectedItemIds.has(id)) {
        state.selectedItemIds.delete(id);
      } else {
        state.selectedItemIds.add(id);
      }
    }),

  selectAll: (ids) =>
    set((state) => {
      state.selectedItemIds = new Set(ids);
    }),

  clearSelection: () =>
    set((state) => {
      state.selectedItemIds = new Set();
    }),

  setMultiSelect: (active) =>
    set((state) => {
      state.isMultiSelectActive = active;
      if (!active) {
        state.selectedItemIds = new Set();
      }
    }),
});
