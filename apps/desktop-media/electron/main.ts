import { app, BrowserWindow, ipcMain } from "electron";
import { APP_DISPLAY_NAME, APP_ID } from "./app-links";
import { installApplicationMenu } from "./application-menu";
import {
  configureAutoUpdater,
  registerAppUpdaterIpc,
  scheduleStartupUpdateCheck,
} from "./app-updater";
import { setDatabaseProvider } from "./face-rotation-check";
import { getDesktopDatabase, initDesktopDatabase } from "./db/client";
import { clearAllInProgressFlags } from "./db/folder-analysis-status";
import { probeMultimodalEmbeddingSupport } from "./semantic-embeddings";
import { createMainWindow } from "./window";
import {
  semanticEmbeddingStatusRef,
} from "./ipc/state";
import { registerFsHandlers } from "./ipc/fs-handlers";
import { registerPhotoAnalysisHandlers } from "./ipc/photo-analysis-handlers";
import { registerFaceDetectionHandlers } from "./ipc/face-detection-handlers";
import { registerFaceTagsHandlers } from "./ipc/face-tags-handlers";
import { registerFaceEmbeddingHandlers } from "./ipc/face-embedding-handlers";
import { registerSemanticSearchHandlers } from "./ipc/semantic-search-handlers";
import { registerSimilarImagesHandlers } from "./ipc/similar-images-handlers";
import { registerMetadataScanHandlers } from "./ipc/metadata-scan-handlers";
import { registerPathAnalysisHandlers } from "./ipc/path-analysis-handlers";
import { registerFolderAiSummaryHandlers } from "./ipc/folder-ai-summary-handlers";
import { registerMediaItemMutationHandlers } from "./ipc/media-item-mutation-handlers";
import { registerRotationReviewHandlers } from "./ipc/rotation-review-handlers";
import { registerGeocoderHandlers } from "./ipc/geocoder-handlers";
import { registerAlbumHandlers } from "./ipc/album-handlers";
import { registerPipelineOrchestrationHandlers } from "./ipc/pipeline-orchestration-handlers";
import { registerAllPipelineDefinitions } from "./pipelines/definitions";
import { setPipelineConcurrencyConfig } from "./pipelines/concurrency-config";
import { releaseAllPowerSave } from "./ipc/power-save-manager";
import {
  ensureActiveModels,
  ensureAuxModel,
  setModelsDirectory,
} from "./native-face";
import { readSettings } from "./storage";
import { DEFAULT_FACE_DETECTION_SETTINGS } from "../src/shared/ipc";
import {
  IPC_CHANNELS,
  type AppSettings,
  type FaceModelDownloadProgressEvent,
} from "../src/shared/ipc";
import { exiftool } from "exiftool-vendored";
import { resolveInstalledUserDataPath } from "./install-config";
import { resolveOnnxModelsPath, resolveSessionDataPath } from "./app-paths";
import { migrateAiModelsLayout } from "./migrate-ai-models-layout";
import {
  applyAiInferenceGpuPreference,
  detectAiInferenceGpuOptions,
} from "./ai-inference-gpu";
import { setSemanticIndexDebugLogPath } from "./semantic-index-debug-log";
import { shouldSkipStartupAiModelsDownload } from "./startup-ai-models";

const configuredUserDataPath = resolveInstalledUserDataPath();
if (configuredUserDataPath) {
  app.setPath("userData", configuredUserDataPath);
}
app.setPath("sessionData", resolveSessionDataPath(app));

app.setName(APP_DISPLAY_NAME);
if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

function registerAllIpcHandlers(): void {
  registerAllPipelineDefinitions();
  registerAppUpdaterIpc();
  registerFsHandlers();
  registerPhotoAnalysisHandlers();
  registerFaceDetectionHandlers();
  registerFaceTagsHandlers();
  registerFaceEmbeddingHandlers();
  registerSemanticSearchHandlers();
  registerSimilarImagesHandlers();
  registerMetadataScanHandlers();
  registerPathAnalysisHandlers();
  registerFolderAiSummaryHandlers();
  registerMediaItemMutationHandlers();
  registerRotationReviewHandlers();
  registerGeocoderHandlers();
  registerAlbumHandlers();
  registerPipelineOrchestrationHandlers();

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

async function ensureStartupNativeFaceModels(
  faceDetection: AppSettings["faceDetection"],
  enableOrientation: boolean,
  onProgress: Parameters<typeof ensureActiveModels>[1],
): Promise<void> {
  await ensureActiveModels(faceDetection.detectorModel, onProgress);
  if (enableOrientation) {
    await ensureAuxModel("orientation", faceDetection.imageOrientationDetection.model, onProgress);
  }
  if (faceDetection.faceLandmarkRefinement.enabled) {
    await ensureAuxModel("landmarks", faceDetection.faceLandmarkRefinement.model, onProgress);
  }
  if (faceDetection.faceAgeGenderDetection.enabled) {
    await ensureAuxModel("age-gender", faceDetection.faceAgeGenderDetection.model, onProgress);
  }
}

function beginStartupNativeFaceModelEnsure(
  faceDetection: AppSettings["faceDetection"],
  enableOrientation: boolean,
): void {
  const modelsStart = Date.now();
  emitFaceModelDownloadProgress({
    type: "started",
    filename: null,
    message: "Downloading AI face detection and recognition models...",
    startedAtIso: new Date().toISOString(),
  });
  void ensureStartupNativeFaceModels(faceDetection, enableOrientation, (progress) => {
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
    })
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      emitFaceModelDownloadProgress({
        type: "failed",
        durationMs: Date.now() - modelsStart,
        error: msg,
        message: "Failed to download AI face detection and recognition models.",
      });
      console.error(
        `[emk-face][models] ensure-fail durationMs=${Date.now() - modelsStart} error=${JSON.stringify(msg)}`,
      );
    });
}

app.whenReady().then(async () => {
  initDesktopDatabase(app.getPath("userData"));
  setSemanticIndexDebugLogPath(app.getPath("userData"));
  setDatabaseProvider(() => getDesktopDatabase());
  clearAllInProgressFlags();

  await migrateAiModelsLayout(app);
  setModelsDirectory(resolveOnnxModelsPath(app));

  semanticEmbeddingStatusRef.current = await probeMultimodalEmbeddingSupport();

  const skipStartupAiModels = shouldSkipStartupAiModelsDownload();
  try {
    const s = await readSettings(app.getPath("userData"));
    const gpuOptions = await detectAiInferenceGpuOptions();
    applyAiInferenceGpuPreference(s.aiInferencePreferredGpuId, gpuOptions);
    // Hydrate the scheduler's concurrency config from saved settings.
    setPipelineConcurrencyConfig(s.pipelineConcurrency);
    if (!skipStartupAiModels) {
      beginStartupNativeFaceModelEnsure(
        s.faceDetection,
        s.wrongImageRotationDetection.enabled,
      );
    }
  } catch {
    if (!skipStartupAiModels) {
      beginStartupNativeFaceModelEnsure(
        DEFAULT_FACE_DETECTION_SETTINGS,
        true,
      );
    }
  }

  ipcMain.on("renderer:log", () => {
    /* Renderer log relay disabled — avoid console.log noise in main. */
  });

  registerAllIpcHandlers();
  configureAutoUpdater();
  createMainWindow();
  installApplicationMenu();
  scheduleStartupUpdateCheck();

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
