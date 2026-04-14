import type { StateCreator } from "zustand";
import type { FaceDetectionItem, FaceServiceStatus, ProcessingItemStatus, TaskStatus } from "../types";

export interface FaceDetectionSlice {
  faceJobId: string | null;
  faceStatus: TaskStatus;
  faceItemsByKey: Record<string, FaceDetectionItem>;
  faceItemOrder: string[];
  faceError: string | null;
  facePanelVisible: boolean;
  faceAverageSecondsPerFile: number | null;
  faceServiceStatus: FaceServiceStatus | null;
  faceServiceRestarting: boolean;
  faceCurrentFolderPath: string | null;

  startFaceJob: (jobId: string, items: FaceDetectionItem[]) => void;
  updateFaceItem: (key: string, updates: { status?: ProcessingItemStatus; elapsedSeconds?: number; faceCount?: number; result?: unknown; error?: string }) => void;
  completeFaceJob: (averageSecondsPerFile: number) => void;
  cancelFaceJob: () => void;
  setFaceError: (error: string | null) => void;
  setFacePanelVisible: (visible: boolean) => void;
  setFaceServiceStatus: (status: FaceServiceStatus | null) => void;
  setFaceCurrentFolderPath: (path: string | null) => void;
  resetFaceDetection: () => void;
}

export const createFaceDetectionSlice: StateCreator<FaceDetectionSlice, [["zustand/immer", never]]> = (set) => ({
  faceJobId: null,
  faceStatus: "idle",
  faceItemsByKey: {},
  faceItemOrder: [],
  faceError: null,
  facePanelVisible: false,
  faceAverageSecondsPerFile: null,
  faceServiceStatus: null,
  faceServiceRestarting: false,
  faceCurrentFolderPath: null,

  startFaceJob: (jobId, items) =>
    set((state) => {
      state.faceJobId = jobId;
      state.faceStatus = "running";
      state.faceError = null;
      state.faceAverageSecondsPerFile = null;
      state.faceItemOrder = items.map((i) => i.path);
      state.faceItemsByKey = {};
      for (const item of items) {
        state.faceItemsByKey[item.path] = item;
      }
      state.facePanelVisible = true;
    }),

  updateFaceItem: (key, updates) =>
    set((state) => {
      const existing = state.faceItemsByKey[key];
      if (existing) {
        Object.assign(existing, updates);
      }
    }),

  completeFaceJob: (averageSecondsPerFile) =>
    set((state) => {
      state.faceStatus = "completed";
      state.faceAverageSecondsPerFile = averageSecondsPerFile;
    }),

  cancelFaceJob: () =>
    set((state) => {
      state.faceStatus = "cancelled";
      for (const key of Object.keys(state.faceItemsByKey)) {
        const item = state.faceItemsByKey[key];
        if (item && (item.status === "pending" || item.status === "running")) {
          item.status = "cancelled";
        }
      }
    }),

  setFaceError: (error) =>
    set((state) => {
      state.faceError = error;
      if (error) {
        state.faceStatus = "failed";
      }
    }),

  setFacePanelVisible: (visible) =>
    set((state) => {
      state.facePanelVisible = visible;
    }),

  setFaceServiceStatus: (status) =>
    set((state) => {
      state.faceServiceStatus = status;
    }),

  setFaceCurrentFolderPath: (path) =>
    set((state) => {
      state.faceCurrentFolderPath = path;
    }),

  resetFaceDetection: () =>
    set((state) => {
      state.faceJobId = null;
      state.faceStatus = "idle";
      state.faceItemsByKey = {};
      state.faceItemOrder = [];
      state.faceError = null;
      state.faceAverageSecondsPerFile = null;
      state.faceCurrentFolderPath = null;
    }),
});
