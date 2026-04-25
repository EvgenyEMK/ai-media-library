import { app, BrowserWindow, ipcMain } from "electron";
import { setDatabaseProvider } from "./face-rotation-check";
import { getDesktopDatabase, initDesktopDatabase } from "./db/client";
import { clearAllInProgressFlags } from "./db/folder-analysis-status";
import { probeMultimodalEmbeddingSupport } from "./semantic-embeddings";
import { createMainWindow } from "./window";
import {
  runningJobs,
  runningFaceDetectionJobs,
  runningMetadataScanJobs,
  runningPathAnalysisJobs,
  semanticIndexJobRef,
  semanticEmbeddingStatusRef,
} from "./ipc/state";
import { registerFsHandlers } from "./ipc/fs-handlers";
import { registerPhotoAnalysisHandlers } from "./ipc/photo-analysis-handlers";
import { registerFaceDetectionHandlers } from "./ipc/face-detection-handlers";
import { registerFaceTagsHandlers } from "./ipc/face-tags-handlers";
import { registerFaceEmbeddingHandlers } from "./ipc/face-embedding-handlers";
import { registerSemanticSearchHandlers } from "./ipc/semantic-search-handlers";
import { registerMetadataScanHandlers } from "./ipc/metadata-scan-handlers";
import { registerPathAnalysisHandlers } from "./ipc/path-analysis-handlers";
import { registerFolderAiSummaryHandlers } from "./ipc/folder-ai-summary-handlers";
import { registerMediaItemMutationHandlers } from "./ipc/media-item-mutation-handlers";
import { registerGeocoderHandlers } from "./ipc/geocoder-handlers";
import { registerAlbumHandlers } from "./ipc/album-handlers";
import { releaseAllPowerSave } from "./ipc/power-save-manager";
import {
  ensureActiveModels,
  setModelsDirectory,
} from "./native-face";
import { readSettings } from "./storage";
import { DEFAULT_FACE_DETECTION_SETTINGS } from "../src/shared/ipc";
import {
  IPC_CHANNELS,
  type ActiveJobStatuses,
  type FaceModelDownloadProgressEvent,
} from "../src/shared/ipc";
import { exiftool } from "exiftool-vendored";
import { resolveInstalledUserDataPath } from "./install-config";
import { resolveModelsPath, resolveSessionDataPath } from "./app-paths";
import {
  applyAiInferenceGpuPreference,
  detectAiInferenceGpuOptions,
} from "./ai-inference-gpu";
import { setSemanticIndexDebugLogPath } from "./semantic-index-debug-log";

const configuredUserDataPath = resolveInstalledUserDataPath();
if (configuredUserDataPath) {
  app.setPath("userData", configuredUserDataPath);
}
app.setPath("sessionData", resolveSessionDataPath(app));

function registerAllIpcHandlers(): void {
  registerFsHandlers();
  registerPhotoAnalysisHandlers();
  registerFaceDetectionHandlers();
  registerFaceTagsHandlers();
  registerFaceEmbeddingHandlers();
  registerSemanticSearchHandlers();
  registerMetadataScanHandlers();
  registerPathAnalysisHandlers();
  registerFolderAiSummaryHandlers();
  registerMediaItemMutationHandlers();
  registerGeocoderHandlers();
  registerAlbumHandlers();

  ipcMain.handle(IPC_CHANNELS.getActiveJobStatuses, (): ActiveJobStatuses => {
    let photoAnalysis: ActiveJobStatuses["photoAnalysis"] = null;
    for (const [jobId, job] of runningJobs) {
      if (!job.cancelled) {
        photoAnalysis = { jobId, folderPath: job.rootFolderPath ?? "" };
        break;
      }
    }

    let faceDetection: ActiveJobStatuses["faceDetection"] = null;
    for (const [jobId, ctx] of runningFaceDetectionJobs) {
      if (!ctx.finalized) {
        faceDetection = { jobId, folderPath: ctx.rootFolderPath };
        break;
      }
    }

    const semJob = semanticIndexJobRef.current;
    const semanticIndex: ActiveJobStatuses["semanticIndex"] =
      semJob && !semJob.cancelled && !semJob.finalized
        ? { jobId: semJob.jobId, folderPath: semJob.folderPath }
        : null;

    let pathAnalysis: ActiveJobStatuses["pathAnalysis"] = null;
    for (const [jobId, job] of runningPathAnalysisJobs) {
      if (!job.cancelled) {
        pathAnalysis = { jobId, folderPath: job.folderPath ?? "" };
        break;
      }
    }

    let metadataScan: ActiveJobStatuses["metadataScan"] = null;
    for (const [jobId, job] of runningMetadataScanJobs) {
      if (!job.cancelled) {
        metadataScan = { jobId, folderPath: "" };
        break;
      }
    }

    return { photoAnalysis, faceDetection, semanticIndex, metadataScan, pathAnalysis };
  });
}

function emitFaceModelDownloadProgress(event: FaceModelDownloadProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send(IPC_CHANNELS.faceModelDownloadProgress, event);
      } catch {
        // Frame may be disposed after sleep/lock; safe to ignore.
      }
    }
  }
}

app.whenReady().then(async () => {
  initDesktopDatabase(app.getPath("userData"));
  setSemanticIndexDebugLogPath(app.getPath("userData"));
  setDatabaseProvider(() => getDesktopDatabase());
  clearAllInProgressFlags();

  setModelsDirectory(resolveModelsPath(app));

  semanticEmbeddingStatusRef.current = await probeMultimodalEmbeddingSupport();

  console.log("[emk-face][startup] using native ONNX pipeline");
  const modelsStart = Date.now();
  console.log("[emk-face][models] ensure-start");
  emitFaceModelDownloadProgress({
    type: "started",
    filename: null,
    message: "Downloading AI face detection and recognition models...",
    startedAtIso: new Date().toISOString(),
  });
  const activeDetectorId = await (async () => {
    try {
      const s = await readSettings(app.getPath("userData"));
      const gpuOptions = await detectAiInferenceGpuOptions();
      applyAiInferenceGpuPreference(s.aiInferencePreferredGpuId, gpuOptions);
      return s.faceDetection.detectorModel;
    } catch {
      return DEFAULT_FACE_DETECTION_SETTINGS.detectorModel;
    }
  })();

  void ensureActiveModels(activeDetectorId, (progress) => {
    emitFaceModelDownloadProgress({
      type: "progress",
      filename: progress.filename,
      downloadedBytes: progress.downloadedBytes,
      totalBytes: progress.totalBytes,
      percent: progress.percent,
      message: "Downloading AI face detection and recognition models...",
    });
  })
    .then(() => {
      emitFaceModelDownloadProgress({
        type: "completed",
        durationMs: Date.now() - modelsStart,
        message: "AI face detection and recognition models are ready.",
      });
      console.log(
        `[emk-face][models] ensure-done durationMs=${Date.now() - modelsStart}`,
      );
    })
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      emitFaceModelDownloadProgress({
        type: "failed",
        durationMs: Date.now() - modelsStart,
        error: msg,
        message: "Failed to download AI face detection and recognition models.",
      });
      console.log(
        `[emk-face][models] ensure-fail durationMs=${Date.now() - modelsStart} error=${JSON.stringify(msg)}`,
      );
    });

  ipcMain.on("renderer:log", (_event, msg: string) => {
    console.log(msg);
  });

  registerAllIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  releaseAllPowerSave();
  void exiftool.end();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
