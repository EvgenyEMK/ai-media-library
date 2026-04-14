import type { StateCreator } from "zustand";
import type { SemanticSearchFilters, SemanticSearchResult, SemanticIndexItem, ProcessingItemStatus, TaskStatus } from "../types";

export type SemanticSearchScope = "global" | "selected" | "recursive";

/** How VLM (image) vs AI-description embeddings combine in AI image search (desktop). */
export type SemanticSearchSignalMode = "hybrid" | "vlm-only" | "description-only";

export type SemanticIndexPhase = "initializing-model" | "indexing" | null;

export interface SemanticSearchSlice {
  semanticQuery: string;
  semanticFilters: SemanticSearchFilters;
  semanticResults: SemanticSearchResult[];
  semanticSearching: boolean;
  semanticStatus: string | null;
  semanticPanelOpen: boolean;
  semanticCapabilityLabel: string | null;
  semanticSearchScope: SemanticSearchScope;
  semanticPersonTagIds: string[];
  semanticIncludeUnconfirmedFaces: boolean;
  semanticAdvancedSearch: boolean;
  semanticSearchSignalMode: SemanticSearchSignalMode;

  semanticIndexJobId: string | null;
  semanticIndexStatus: TaskStatus;
  semanticIndexItemsByKey: Record<string, SemanticIndexItem>;
  semanticIndexItemOrder: string[];
  semanticIndexError: string | null;
  semanticIndexPanelVisible: boolean;
  semanticIndexCurrentFolderPath: string | null;
  semanticIndexAverageSecondsPerFile: number | null;
  /** ONNX vision model warmup vs processing catalog images (desktop semantic indexing). */
  semanticIndexPhase: SemanticIndexPhase;

  setSemanticQuery: (query: string) => void;
  setSemanticFilters: (filters: Partial<SemanticSearchFilters>) => void;
  clearSemanticFilters: () => void;
  setSemanticResults: (results: SemanticSearchResult[]) => void;
  setSemanticSearching: (searching: boolean) => void;
  setSemanticStatus: (status: string | null) => void;
  setSemanticCapabilityLabel: (label: string | null) => void;
  toggleSemanticPanel: () => void;
  setSemanticPanelOpen: (open: boolean) => void;
  resetSemanticSearch: () => void;
  setSemanticIndexPanelVisible: (visible: boolean) => void;
  setSemanticSearchScope: (scope: SemanticSearchScope) => void;
  setSemanticPersonTagIds: (ids: string[]) => void;
  setSemanticIncludeUnconfirmedFaces: (include: boolean) => void;
  setSemanticAdvancedSearch: (on: boolean) => void;
  setSemanticSearchSignalMode: (mode: SemanticSearchSignalMode) => void;
}

export const createSemanticSearchSlice: StateCreator<SemanticSearchSlice, [["zustand/immer", never]]> = (set) => ({
  semanticQuery: "",
  semanticFilters: {},
  semanticResults: [],
  semanticSearching: false,
  semanticStatus: null,
  semanticPanelOpen: false,
  semanticCapabilityLabel: null,
  semanticSearchScope: "global",
  semanticPersonTagIds: [],
  semanticIncludeUnconfirmedFaces: true,
  semanticAdvancedSearch: false,
  semanticSearchSignalMode: "hybrid",

  semanticIndexJobId: null,
  semanticIndexStatus: "idle",
  semanticIndexItemsByKey: {},
  semanticIndexItemOrder: [],
  semanticIndexError: null,
  semanticIndexPanelVisible: false,
  semanticIndexCurrentFolderPath: null,
  semanticIndexAverageSecondsPerFile: null,
  semanticIndexPhase: null,

  setSemanticQuery: (query) =>
    set((state) => {
      state.semanticQuery = query;
    }),

  setSemanticFilters: (filters) =>
    set((state) => {
      Object.assign(state.semanticFilters, filters);
    }),

  clearSemanticFilters: () =>
    set((state) => {
      state.semanticFilters = {};
    }),

  setSemanticResults: (results) =>
    set((state) => {
      state.semanticResults = results;
    }),

  setSemanticSearching: (searching) =>
    set((state) => {
      state.semanticSearching = searching;
    }),

  setSemanticStatus: (status) =>
    set((state) => {
      state.semanticStatus = status;
    }),

  setSemanticCapabilityLabel: (label) =>
    set((state) => {
      state.semanticCapabilityLabel = label;
    }),

  toggleSemanticPanel: () =>
    set((state) => {
      state.semanticPanelOpen = !state.semanticPanelOpen;
    }),

  setSemanticPanelOpen: (open) =>
    set((state) => {
      state.semanticPanelOpen = open;
    }),

  resetSemanticSearch: () =>
    set((state) => {
      state.semanticQuery = "";
      state.semanticFilters = {};
      state.semanticResults = [];
      state.semanticSearching = false;
      state.semanticStatus = null;
    }),

  setSemanticIndexPanelVisible: (visible) =>
    set((state) => {
      state.semanticIndexPanelVisible = visible;
    }),

  setSemanticSearchScope: (scope) =>
    set((state) => {
      state.semanticSearchScope = scope;
    }),

  setSemanticPersonTagIds: (ids) =>
    set((state) => {
      state.semanticPersonTagIds = ids;
    }),

  setSemanticIncludeUnconfirmedFaces: (include) =>
    set((state) => {
      state.semanticIncludeUnconfirmedFaces = include;
    }),

  setSemanticAdvancedSearch: (on) =>
    set((state) => {
      state.semanticAdvancedSearch = on;
    }),

  setSemanticSearchSignalMode: (mode) =>
    set((state) => {
      state.semanticSearchSignalMode = mode;
    }),
});
