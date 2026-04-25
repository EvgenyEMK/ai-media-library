import type { StateCreator } from "zustand";
import type { MetadataScanItem, ProcessingItemStatus, MetadataScanItemAction, TaskStatus } from "../types";

export type MetadataScanPhase = "preparing" | "scanning" | "geocoding";

export interface MetadataScanSummary {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  cancelled: number;
  total: number;
  gpsGeocodingEnabled: boolean;
  geoDataUpdated: number;
}

export interface MetadataScanSlice {
  metadataJobId: string | null;
  metadataStatus: TaskStatus;
  metadataItemsByKey: Record<string, MetadataScanItem>;
  metadataItemOrder: string[];
  metadataError: string | null;
  metadataPanelVisible: boolean;
  metadataSummary: MetadataScanSummary | null;
  metadataCurrentFolderPath: string | null;
  metadataPhase: MetadataScanPhase | null;
  metadataPhaseProcessed: number;
  metadataPhaseTotal: number;
  metadataGpsGeocodingEnabled: boolean;
  metadataGeoDataUpdated: number;

  startMetadataJob: (jobId: string, items: MetadataScanItem[]) => void;
  updateMetadataItem: (key: string, updates: { status?: ProcessingItemStatus; action?: MetadataScanItemAction; mediaItemId?: string | null; error?: string }) => void;
  completeMetadataJob: (summary: MetadataScanSummary) => void;
  cancelMetadataJob: () => void;
  setMetadataError: (error: string | null) => void;
  setMetadataPanelVisible: (visible: boolean) => void;
  setMetadataCurrentFolderPath: (path: string | null) => void;
  resetMetadataScan: () => void;
}

export const createMetadataScanSlice: StateCreator<MetadataScanSlice, [["zustand/immer", never]]> = (set) => ({
  metadataJobId: null,
  metadataStatus: "idle",
  metadataItemsByKey: {},
  metadataItemOrder: [],
  metadataError: null,
  metadataPanelVisible: false,
  metadataSummary: null,
  metadataCurrentFolderPath: null,
  metadataPhase: null,
  metadataPhaseProcessed: 0,
  metadataPhaseTotal: 0,
  metadataGpsGeocodingEnabled: false,
  metadataGeoDataUpdated: 0,

  startMetadataJob: (jobId, items) =>
    set((state) => {
      state.metadataJobId = jobId;
      state.metadataStatus = "running";
      state.metadataError = null;
      state.metadataSummary = null;
      state.metadataItemOrder = items.map((i) => i.path);
      state.metadataItemsByKey = {};
      state.metadataPhase = "scanning";
      state.metadataPhaseProcessed = 0;
      state.metadataPhaseTotal = items.length;
      state.metadataGpsGeocodingEnabled = false;
      state.metadataGeoDataUpdated = 0;
      for (const item of items) {
        state.metadataItemsByKey[item.path] = item;
      }
      state.metadataPanelVisible = true;
    }),

  updateMetadataItem: (key, updates) =>
    set((state) => {
      const existing = state.metadataItemsByKey[key];
      if (existing) {
        Object.assign(existing, updates);
      }
    }),

  completeMetadataJob: (summary) =>
    set((state) => {
      state.metadataStatus = "completed";
      state.metadataSummary = summary;
    }),

  cancelMetadataJob: () =>
    set((state) => {
      state.metadataStatus = "cancelled";
      for (const key of Object.keys(state.metadataItemsByKey)) {
        const item = state.metadataItemsByKey[key];
        if (item && (item.status === "pending" || item.status === "running")) {
          item.status = "cancelled";
        }
      }
    }),

  setMetadataError: (error) =>
    set((state) => {
      state.metadataError = error;
      if (error) {
        state.metadataStatus = "failed";
      }
    }),

  setMetadataPanelVisible: (visible) =>
    set((state) => {
      state.metadataPanelVisible = visible;
    }),

  setMetadataCurrentFolderPath: (path) =>
    set((state) => {
      state.metadataCurrentFolderPath = path;
    }),

  resetMetadataScan: () =>
    set((state) => {
      state.metadataJobId = null;
      state.metadataStatus = "idle";
      state.metadataItemsByKey = {};
      state.metadataItemOrder = [];
      state.metadataError = null;
      state.metadataSummary = null;
      state.metadataCurrentFolderPath = null;
      state.metadataPhase = null;
      state.metadataPhaseProcessed = 0;
      state.metadataPhaseTotal = 0;
      state.metadataGpsGeocodingEnabled = false;
      state.metadataGeoDataUpdated = 0;
    }),
});
