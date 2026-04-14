import type { StateCreator } from "zustand";
import type { TaskStatus } from "../types";

export type FaceClusteringProgressPhase = "loading" | "clustering" | "persisting";

export interface FaceClusteringSlice {
  faceClusteringJobId: string | null;
  faceClusteringStatus: TaskStatus;
  faceClusteringPhase: FaceClusteringProgressPhase | null;
  faceClusteringProcessed: number;
  faceClusteringTotal: number;
  faceClusteringTotalFaces: number;
  faceClusteringClusterCount: number | null;
  faceClusteringError: string | null;
  faceClusteringPanelVisible: boolean;

  startFaceClusteringJob: (jobId: string, totalFaces: number) => void;
  updateFaceClusteringProgress: (payload: {
    phase: FaceClusteringProgressPhase;
    processed: number;
    total: number;
  }) => void;
  completeFaceClusteringJob: (clusterCount: number) => void;
  failFaceClusteringJob: (error: string) => void;
  cancelFaceClusteringJob: () => void;
  setFaceClusteringPanelVisible: (visible: boolean) => void;
  resetFaceClustering: () => void;
}

export const createFaceClusteringSlice: StateCreator<
  FaceClusteringSlice,
  [["zustand/immer", never]]
> = (set) => ({
  faceClusteringJobId: null,
  faceClusteringStatus: "idle",
  faceClusteringPhase: null,
  faceClusteringProcessed: 0,
  faceClusteringTotal: 0,
  faceClusteringTotalFaces: 0,
  faceClusteringClusterCount: null,
  faceClusteringError: null,
  faceClusteringPanelVisible: false,

  startFaceClusteringJob: (jobId, totalFaces) =>
    set((state) => {
      state.faceClusteringJobId = jobId;
      state.faceClusteringStatus = "running";
      state.faceClusteringPhase = "loading";
      state.faceClusteringProcessed = 0;
      state.faceClusteringTotal = Math.max(1, totalFaces);
      state.faceClusteringTotalFaces = totalFaces;
      state.faceClusteringClusterCount = null;
      state.faceClusteringError = null;
      state.faceClusteringPanelVisible = true;
    }),

  updateFaceClusteringProgress: ({ phase, processed, total }) =>
    set((state) => {
      state.faceClusteringPhase = phase;
      state.faceClusteringProcessed = processed;
      state.faceClusteringTotal = Math.max(1, total);
    }),

  completeFaceClusteringJob: (clusterCount) =>
    set((state) => {
      state.faceClusteringStatus = "completed";
      state.faceClusteringPhase = null;
      state.faceClusteringClusterCount = clusterCount;
      state.faceClusteringProcessed = state.faceClusteringTotal;
    }),

  failFaceClusteringJob: (error) =>
    set((state) => {
      state.faceClusteringStatus = "failed";
      state.faceClusteringPhase = null;
      state.faceClusteringError = error;
    }),

  cancelFaceClusteringJob: () =>
    set((state) => {
      state.faceClusteringStatus = "cancelled";
      state.faceClusteringPhase = null;
    }),

  setFaceClusteringPanelVisible: (visible) =>
    set((state) => {
      state.faceClusteringPanelVisible = visible;
    }),

  resetFaceClustering: () =>
    set((state) => {
      state.faceClusteringJobId = null;
      state.faceClusteringStatus = "idle";
      state.faceClusteringPhase = null;
      state.faceClusteringProcessed = 0;
      state.faceClusteringTotal = 0;
      state.faceClusteringTotalFaces = 0;
      state.faceClusteringClusterCount = null;
      state.faceClusteringError = null;
    }),
});
