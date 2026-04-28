import type { BrowserWindow } from "electron";

export interface RunningAnalysisJob {
  kind: "photo" | "face-detection" | "face-embedding";
  cancelled: boolean;
  controllers: Set<AbortController>;
  powerSaveToken?: string;
  rootFolderPath?: string;
  warmupController?: AbortController;
}

export type FaceJobRuntimeStatus = "pending" | "running" | "settled";

export interface RunningFaceDetectionJobContext {
  browserWindow: BrowserWindow;
  rootFolderPath: string;
  itemsByPath: Map<
    string,
    {
      name: string;
      folderPath: string;
      status: FaceJobRuntimeStatus;
    }
  >;
  completed: number;
  failed: number;
  cancelled: number;
  elapsedTotalSeconds: number;
  finalized: boolean;
  powerSaveToken?: string;
}

export type SemanticJobRuntimeStatus = "pending" | "running" | "settled";

export interface RunningSemanticIndexJob {
  jobId: string;
  folderPath: string;
  cancelled: boolean;
  finalized: boolean;
  controllers: Set<AbortController>;
  powerSaveToken?: string;
  browserWindow: import("electron").BrowserWindow;
  itemsByPath: Map<
    string,
    { name: string; folderPath: string; status: SemanticJobRuntimeStatus }
  >;
  completed: number;
  failed: number;
  cancelledCount: number;
  totalElapsedSeconds: number;
}

export interface RunningMetadataScanJob {
  cancelled: boolean;
  triggerSource: "auto" | "manual";
  powerSaveToken?: string;
}

export interface RunningPathAnalysisJob {
  cancelled: boolean;
  powerSaveToken?: string;
  folderPath?: string;
}

export interface RunningImageRotationJob {
  cancelled: boolean;
  folderPath: string;
}
