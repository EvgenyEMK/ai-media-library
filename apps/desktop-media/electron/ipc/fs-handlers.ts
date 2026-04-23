import path from "node:path";
import { randomUUID } from "node:crypto";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import {
  IPC_CHANNELS,
  type AppSettings,
  type FolderAnalysisStatus,
} from "../../src/shared/ipc";
import {
  listFolderImages,
  listFolderMedia,
  listFolderVideos,
  readFolderChildren,
  streamFolderImages,
  streamFolderMedia,
} from "../fs-media";
import { readSettings, writeSettings } from "../storage";
import {
  applyAiInferenceGpuPreference,
  detectAiInferenceGpuOptions,
} from "../ai-inference-gpu";
import {
  getFolderAnalysisStatuses,
  pruneFolderAnalysisStatusesForMissingChildren,
} from "../db/folder-analysis-status";
import { emitFolderImagesProgress, emitFolderMediaProgress } from "./progress-emitters";
import { runMetadataScanJob } from "./metadata-scan-handlers";
import { runningMetadataScanJobs } from "./state";
import { getModelsDirectory } from "../native-face/model-manager";
import { resolveCacheRoot } from "../app-paths";
import { getMediaEmbeddingsCompatStatus } from "../db/client";
import { getSemanticIndexDebugLogPath } from "../semantic-index-debug-log";
import { releasePowerSave } from "./power-save-manager";
import {
  resetAgeGenderEstimator,
  resetLandmarkRefiner,
  resetNativeDetector,
  resetNativeEmbedder,
  resetOrientationClassifier,
  resetYoloDetector,
} from "../native-face";

function ts(): string {
  return new Date().toISOString();
}
function isDebugEnabled(): boolean {
  return process.env.EMK_DEBUG_PHOTO_AI === "1";
}

function cancelRunningAutoMetadataScans(): void {
  for (const job of runningMetadataScanJobs.values()) {
    if (job.triggerSource !== "auto") {
      continue;
    }
    job.cancelled = true;
    if (job.powerSaveToken) {
      releasePowerSave(job.powerSaveToken);
      job.powerSaveToken = undefined;
    }
  }
}

function hasRunningManualMetadataScan(): boolean {
  for (const job of runningMetadataScanJobs.values()) {
    if (job.triggerSource === "manual" && !job.cancelled) {
      return true;
    }
  }
  return false;
}

export function registerFsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.selectLibraryFolder, async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select media library folder",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.readFolderChildren, async (_event, folderPath: string) => {
    return readFolderChildren(folderPath);
  });
  ipcMain.handle(
    IPC_CHANNELS.pruneFolderAnalysisForMissingChildren,
    async (_event, parentPath: string, existingChildren: string[]): Promise<{ removed: number }> => {
      const removed = pruneFolderAnalysisStatusesForMissingChildren(
        parentPath,
        Array.isArray(existingChildren) ? existingChildren : [],
      );
      return { removed };
    },
  );

  ipcMain.handle(IPC_CHANNELS.revealItemInFolder, async (_event, filePath: string) => {
    const trimmed = typeof filePath === "string" ? filePath.trim() : "";
    if (!trimmed) {
      return { success: false, error: "File path is required." };
    }
    try {
      shell.showItemInFolder(trimmed);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reveal file in folder.";
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.listFolderImages, async (_event, folderPath: string) => {
    const images = await listFolderImages(folderPath);
    const videos = await listFolderVideos(folderPath);
    const knownCatalogEntries = [
      ...images.map((image) => ({
        folderPath,
        path: image.path,
        name: image.name,
      })),
      ...videos.map((video) => ({
        folderPath,
        path: video.path,
        name: video.name,
      })),
    ];
    const settings = await readSettings(app.getPath("userData"));
    if (
      knownCatalogEntries.length < settings.folderScanning.autoMetadataScanOnSelectMaxFiles &&
      !hasRunningManualMetadataScan()
    ) {
      void runMetadataScanJob({
        folderPath,
        recursive: false,
        knownCatalogEntries,
      }).catch(() => undefined);
    }
    return images;
  });

  ipcMain.handle(IPC_CHANNELS.startFolderImagesStream, async (event, folderPath: string) => {
    const normalizedFolderPath = folderPath?.trim();
    if (!normalizedFolderPath) {
      throw new Error("Folder path is required for image streaming");
    }

    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
      throw new Error("Unable to locate image streaming window");
    }

    const requestId = randomUUID();
    if (isDebugEnabled()) {
      console.log(
        `[folder-stream][main][${ts()}] start requestId=${requestId} folder="${normalizedFolderPath}"`,
      );
    }
    setTimeout(() => {
      void runFolderImagesStream(browserWindow, requestId, normalizedFolderPath);
    }, 0);
    return { requestId };
  });

  ipcMain.handle(IPC_CHANNELS.listFolderMedia, async (_event, folderPath: string) => {
    return listFolderMedia(folderPath);
  });

  ipcMain.handle(IPC_CHANNELS.startFolderMediaStream, async (event, folderPath: string) => {
    const normalizedFolderPath = folderPath?.trim();
    if (!normalizedFolderPath) {
      throw new Error("Folder path is required for media streaming");
    }

    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
      throw new Error("Unable to locate media streaming window");
    }

    const requestId = randomUUID();
    if (isDebugEnabled()) {
      console.log(
        `[folder-stream][main][${ts()}] start-media requestId=${requestId} folder="${normalizedFolderPath}"`,
      );
    }
    setTimeout(() => {
      void runFolderMediaStream(browserWindow, requestId, normalizedFolderPath);
    }, 0);
    return { requestId };
  });

  ipcMain.handle(IPC_CHANNELS.getSettings, async () => {
    return readSettings(app.getPath("userData"));
  });

  ipcMain.handle(IPC_CHANNELS.getDatabaseLocation, async () => {
    const userDataPath = app.getPath("userData");
    const appDataPath = app.getPath("appData");
    let modelsPath: string | null = null;
    try {
      modelsPath = getModelsDirectory();
    } catch {
      modelsPath = null;
    }
    let cachePath: string | null = null;
    try {
      cachePath = resolveCacheRoot(app);
    } catch {
      cachePath = null;
    }
    return {
      appDataPath,
      userDataPath,
      dbFileName: "desktop-media.db",
      dbPath: path.join(userDataPath, "desktop-media.db"),
      modelsPath: modelsPath ?? path.join(appDataPath, "EMK Desktop Media", "ai-models"),
      cachePath: cachePath ?? path.join(appDataPath, "EMK Desktop Media", "cache"),
      mediaEmbeddingsCompatStatus: getMediaEmbeddingsCompatStatus(),
      semanticDebugLogPath: getSemanticIndexDebugLogPath(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.getAiInferenceGpuOptions, async () => {
    return detectAiInferenceGpuOptions();
  });

  ipcMain.handle(IPC_CHANNELS.saveSettings, async (_event, settings: AppSettings) => {
    const gpuOptions = await detectAiInferenceGpuOptions();
    applyAiInferenceGpuPreference(settings.aiInferencePreferredGpuId, gpuOptions);
    // Recreate ONNX sessions lazily with the newly selected GPU preference.
    resetNativeDetector();
    resetYoloDetector("yolov12n-face");
    resetYoloDetector("yolov12s-face");
    resetYoloDetector("yolov12m-face");
    resetYoloDetector("yolov12l-face");
    resetNativeEmbedder();
    resetOrientationClassifier("deep-image-orientation-v1");
    resetLandmarkRefiner("pfld-ghostone");
    resetAgeGenderEstimator("onnx-age-gender-v1");
    await writeSettings(app.getPath("userData"), settings);
  });

  ipcMain.handle(
    IPC_CHANNELS.getFolderAnalysisStatuses,
    async (): Promise<Record<string, FolderAnalysisStatus>> => {
      return getFolderAnalysisStatuses();
    },
  );
}

async function runFolderMediaStream(
  browserWindow: BrowserWindow,
  requestId: string,
  folderPath: string,
): Promise<void> {
  let loaded = 0;
  const observedCatalogPaths: string[] = [];
  const startedAt = Date.now();

  emitFolderMediaProgress(browserWindow, {
    type: "started",
    requestId,
    folderPath,
    total: null,
    loaded,
  });

  try {
    const result = await streamFolderMedia(
      folderPath,
      async (items) => {
        loaded += items.length;
        if ((loaded === items.length || loaded % 500 === 0) && isDebugEnabled()) {
          console.log(
            `[folder-stream][main][${ts()}] media-batch requestId=${requestId} loaded=${loaded} (+${items.length}) folder="${folderPath}"`,
          );
        }
        observedCatalogPaths.push(...items.map((item) => item.path));
        emitFolderMediaProgress(browserWindow, {
          type: "batch",
          requestId,
          folderPath,
          total: null,
          loaded,
          items,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      { batchSize: 24 },
    );

    emitFolderMediaProgress(browserWindow, {
      type: "completed",
      requestId,
      folderPath,
      total: result.loaded,
      loaded: result.loaded,
    });
    if (isDebugEnabled()) {
      console.log(
        `[folder-stream][main][${ts()}] media-completed requestId=${requestId} folder="${folderPath}" loaded=${result.loaded} durationMs=${Date.now() - startedAt}`,
      );
    }

    cancelRunningAutoMetadataScans();
    const knownCatalogEntries = observedCatalogPaths.map((p) => ({
      folderPath,
      path: p,
      name: path.basename(p),
    }));
    const settings = await readSettings(app.getPath("userData"));
    if (
      knownCatalogEntries.length < settings.folderScanning.autoMetadataScanOnSelectMaxFiles &&
      !hasRunningManualMetadataScan()
    ) {
      setTimeout(() => {
        void runMetadataScanJob({
          folderPath,
          recursive: false,
          knownCatalogEntries,
        }).catch(() => undefined);
      }, 300);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stream folder media";
    emitFolderMediaProgress(browserWindow, {
      type: "failed",
      requestId,
      folderPath,
      error: message,
    });
    if (isDebugEnabled()) {
      console.log(
        `[folder-stream][main][${ts()}][error] media-failed requestId=${requestId} folder="${folderPath}" loaded=${loaded} durationMs=${Date.now() - startedAt} error="${message}"`,
      );
    }
  }
}

async function runFolderImagesStream(
  browserWindow: BrowserWindow,
  requestId: string,
  folderPath: string,
): Promise<void> {
  let loaded = 0;
  const observedPaths: string[] = [];
  const startedAt = Date.now();

  emitFolderImagesProgress(browserWindow, {
    type: "started",
    requestId,
    folderPath,
    total: null,
    loaded,
  });

  try {
    const result = await streamFolderImages(
      folderPath,
      async (items) => {
        loaded += items.length;
        if ((loaded === items.length || loaded % 500 === 0) && isDebugEnabled()) {
          console.log(
            `[folder-stream][main][${ts()}] batch requestId=${requestId} loaded=${loaded} (+${items.length}) folder="${folderPath}"`,
          );
        }
        observedPaths.push(...items.map((item) => item.path));
        emitFolderImagesProgress(browserWindow, {
          type: "batch",
          requestId,
          folderPath,
          total: null,
          loaded,
          items,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      // Smaller batches improve time-to-first-thumbnail for large folders.
      { batchSize: 24 },
    );

    emitFolderImagesProgress(browserWindow, {
      type: "completed",
      requestId,
      folderPath,
      total: result.loaded,
      loaded: result.loaded,
    });
    if (isDebugEnabled()) {
      console.log(
        `[folder-stream][main][${ts()}] completed requestId=${requestId} folder="${folderPath}" loaded=${result.loaded} durationMs=${Date.now() - startedAt}`,
      );
    }

    cancelRunningAutoMetadataScans();

    const videos = await listFolderVideos(folderPath);
    const knownCatalogEntries = [
      ...observedPaths.map((p) => ({
        folderPath,
        path: p,
        name: path.basename(p),
      })),
      ...videos.map((v) => ({
        folderPath,
        path: v.path,
        name: v.name,
      })),
    ];
    const settings = await readSettings(app.getPath("userData"));
    if (
      knownCatalogEntries.length < settings.folderScanning.autoMetadataScanOnSelectMaxFiles &&
      !hasRunningManualMetadataScan()
    ) {
      // Delay scan start so the renderer can complete its pending
      // getMediaItemsByPaths calls for the final stream batches before the
      // scan's synchronous DB work starts competing for the main thread.
      setTimeout(() => {
        void runMetadataScanJob({
          folderPath,
          recursive: false,
          knownCatalogEntries,
        }).catch(() => undefined);
      }, 300);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stream folder images";
    emitFolderImagesProgress(browserWindow, {
      type: "failed",
      requestId,
      folderPath,
      error: message,
    });
    if (isDebugEnabled()) {
      console.log(
        `[folder-stream][main][${ts()}][error] failed requestId=${requestId} folder="${folderPath}" loaded=${loaded} durationMs=${Date.now() - startedAt} error="${message}"`,
      );
    }
  }
}
