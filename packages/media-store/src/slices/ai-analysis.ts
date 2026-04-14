import type { StateCreator } from "zustand";
import type { AiAnalysisItem, ProcessingItemStatus, TaskStatus } from "../types";

export interface AiAnalysisSlice {
  aiJobId: string | null;
  aiStatus: TaskStatus;
  aiItemsByKey: Record<string, AiAnalysisItem>;
  aiItemOrder: string[];
  aiError: string | null;
  aiPanelVisible: boolean;
  aiSelectedModel: string;
  aiThinkingEnabled: boolean;
  aiAverageSecondsPerFile: number | null;
  aiCurrentFolderPath: string | null;
  aiPhase: "initializing-model" | "analyzing" | null;

  startAiJob: (jobId: string, items: AiAnalysisItem[]) => void;
  updateAiItem: (key: string, updates: { status?: ProcessingItemStatus; elapsedSeconds?: number; result?: unknown; error?: string }) => void;
  completeAiJob: (averageSecondsPerFile: number) => void;
  cancelAiJob: () => void;
  setAiError: (error: string | null) => void;
  setAiPanelVisible: (visible: boolean) => void;
  setAiSelectedModel: (model: string) => void;
  setAiThinkingEnabled: (enabled: boolean) => void;
  setAiCurrentFolderPath: (path: string | null) => void;
  resetAiAnalysis: () => void;
}

export const createAiAnalysisSlice: StateCreator<AiAnalysisSlice, [["zustand/immer", never]]> = (set) => ({
  aiJobId: null,
  aiStatus: "idle",
  aiItemsByKey: {},
  aiItemOrder: [],
  aiError: null,
  aiPanelVisible: false,
  aiSelectedModel: "qwen3.5:9b",
  aiThinkingEnabled: false,
  aiAverageSecondsPerFile: null,
  aiCurrentFolderPath: null,
  aiPhase: null,

  startAiJob: (jobId, items) =>
    set((state) => {
      state.aiJobId = jobId;
      state.aiStatus = "running";
      state.aiError = null;
      state.aiAverageSecondsPerFile = null;
      state.aiPhase = null;
      state.aiItemOrder = items.map((i) => i.path);
      state.aiItemsByKey = {};
      for (const item of items) {
        state.aiItemsByKey[item.path] = item;
      }
      state.aiPanelVisible = true;
    }),

  updateAiItem: (key, updates) =>
    set((state) => {
      const existing = state.aiItemsByKey[key];
      if (existing) {
        Object.assign(existing, updates);
      }
    }),

  completeAiJob: (averageSecondsPerFile) =>
    set((state) => {
      state.aiStatus = "completed";
      state.aiAverageSecondsPerFile = averageSecondsPerFile;
      state.aiPhase = null;
    }),

  cancelAiJob: () =>
    set((state) => {
      state.aiStatus = "cancelled";
      for (const key of Object.keys(state.aiItemsByKey)) {
        const item = state.aiItemsByKey[key];
        if (item && (item.status === "pending" || item.status === "running")) {
          item.status = "cancelled";
        }
      }
    }),

  setAiError: (error) =>
    set((state) => {
      state.aiError = error;
      if (error) {
        state.aiStatus = "failed";
        state.aiPhase = null;
      }
    }),

  setAiPanelVisible: (visible) =>
    set((state) => {
      state.aiPanelVisible = visible;
    }),

  setAiSelectedModel: (model) =>
    set((state) => {
      state.aiSelectedModel = model;
    }),

  setAiThinkingEnabled: (enabled) =>
    set((state) => {
      state.aiThinkingEnabled = enabled;
    }),

  setAiCurrentFolderPath: (path) =>
    set((state) => {
      state.aiCurrentFolderPath = path;
    }),

  resetAiAnalysis: () =>
    set((state) => {
      state.aiJobId = null;
      state.aiStatus = "idle";
      state.aiItemsByKey = {};
      state.aiItemOrder = [];
      state.aiError = null;
      state.aiAverageSecondsPerFile = null;
      state.aiCurrentFolderPath = null;
      state.aiPhase = null;
    }),
});
