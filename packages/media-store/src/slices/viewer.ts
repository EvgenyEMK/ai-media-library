import type { StateCreator } from "zustand";
import type { ViewerSource } from "../types";

/** When set, the photo viewer uses this list instead of folder/search items (e.g. opening a file from People). */
export interface ViewerItemListEntry {
  id: string;
  sourcePath: string;
  title: string;
  storage_url: string;
  thumbnail_url: string;
  width?: number | null;
  height?: number | null;
  mediaItemId?: string | null;
  mediaType?: "image" | "video";
}

export interface OpenViewerOptions {
  showInfoPanel?: boolean;
  activeInfoTab?: string | null;
  itemListOverride?: ViewerItemListEntry[] | null;
  /** True only when opening viewer from folder thumbnail click on video. */
  autoPlayInitialVideo?: boolean;
}

export interface ViewerSlice {
  viewerOpen: boolean;
  viewerCurrentIndex: number;
  viewerSource: ViewerSource;
  viewerShowInfoPanel: boolean;
  viewerActiveInfoTab: string | null;
  viewerSelectedFaceIndex: number | null;
  viewerItemsOverride: ViewerItemListEntry[] | null;
  viewerAutoPlayInitialVideo: boolean;

  openViewer: (index: number, source: ViewerSource, options?: OpenViewerOptions) => void;
  closeViewer: () => void;
  setViewerCurrentIndex: (index: number) => void;
  toggleViewerInfoPanel: () => void;
  setViewerShowInfoPanel: (show: boolean) => void;
  setViewerActiveInfoTab: (tab: string | null) => void;
  setViewerSelectedFaceIndex: (index: number | null) => void;
}

export const createViewerSlice: StateCreator<ViewerSlice, [["zustand/immer", never]]> = (set) => ({
  viewerOpen: false,
  viewerCurrentIndex: 0,
  viewerSource: null,
  viewerShowInfoPanel: false,
  viewerActiveInfoTab: null,
  viewerSelectedFaceIndex: null,
  viewerItemsOverride: null,
  viewerAutoPlayInitialVideo: false,

  openViewer: (index, source, options) =>
    set((state) => {
      state.viewerOpen = true;
      state.viewerCurrentIndex = index;
      state.viewerSource = source;
      state.viewerSelectedFaceIndex = null;
      if (options?.itemListOverride !== undefined) {
        state.viewerItemsOverride = options.itemListOverride;
      } else {
        state.viewerItemsOverride = null;
      }
      state.viewerAutoPlayInitialVideo = Boolean(options?.autoPlayInitialVideo);
      if (options?.showInfoPanel !== undefined) {
        state.viewerShowInfoPanel = options.showInfoPanel;
      } else {
        state.viewerShowInfoPanel = false;
      }
      state.viewerActiveInfoTab = options?.activeInfoTab ?? null;
    }),

  closeViewer: () =>
    set((state) => {
      state.viewerOpen = false;
      state.viewerSelectedFaceIndex = null;
      state.viewerShowInfoPanel = false;
      state.viewerActiveInfoTab = null;
      state.viewerItemsOverride = null;
      state.viewerAutoPlayInitialVideo = false;
    }),

  setViewerCurrentIndex: (index) =>
    set((state) => {
      state.viewerCurrentIndex = index;
      state.viewerSelectedFaceIndex = null;
    }),

  toggleViewerInfoPanel: () =>
    set((state) => {
      state.viewerShowInfoPanel = !state.viewerShowInfoPanel;
    }),

  setViewerShowInfoPanel: (show) =>
    set((state) => {
      state.viewerShowInfoPanel = show;
    }),

  setViewerActiveInfoTab: (tab) =>
    set((state) => {
      state.viewerActiveInfoTab = tab;
    }),

  setViewerSelectedFaceIndex: (index) =>
    set((state) => {
      state.viewerSelectedFaceIndex = index;
    }),
});
