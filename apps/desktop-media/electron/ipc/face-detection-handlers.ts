import { randomUUID } from "node:crypto";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  IPC_CHANNELS,
  type AppSettings,
  type DetectFolderFacesRequest,
  type FaceDetectionOutput,
  type FaceDetectionItemState,
  type FaceDetectionServiceStatus,
} from "../../src/shared/ipc";
import { listFolderImages } from "../fs-media";
import { detectFacesInPhotoWithOrientation } from "../face-detection";
import { readSettings } from "../storage";
import {
  getAlreadyFaceDetectedPhotoPaths,
  getFaceDetectionFailedPaths,
  getOrientationDetectionStateByPath,
  markFaceDetectionFailed,
  upsertFaceDetectionResult,
} from "../db/media-analysis";
import {
  markFolderAnalyzed,
  setFolderAnalysisInProgress,
} from "../db/folder-analysis-status";
import { appendSyncOperation } from "../db/sync-log";
import {
  ensureFaceDetectionServiceRunning,
  getFaceDetectionServiceStatus,
} from "../face-service";
import type {
  AuxModelId,
  AuxModelKind,
  FaceDetectorModelId,
  FaceModelDownloadProgressEvent,
} from "../../src/shared/ipc";
import {
  ensureAuxModel,
  ensureDetectorModel,
  isAuxModelDownloaded,
  isDetectorModelDownloaded,
} from "../native-face";
import { emitFaceDetectionProgress } from "./progress-emitters";
import {
  runningJobs,
  runningFaceDetectionJobs,
  detectedFacesByFolder,
} from "./state";
import type { RunningAnalysisJob, RunningFaceDetectionJobContext } from "./types";
import {
  collectFoldersRecursivelyWithProgress,
  clampConcurrency,
  ensureCatalogForImagesWithProgress,
  ensureMetadataForImage,
} from "./folder-utils";
import { autoChainEmbeddings } from "./face-embedding-handlers";
import { acquirePowerSave, releasePowerSave } from "./power-save-manager";
import { orderPendingPipelineItems, type PipelineImageItem } from "./pipeline-item-order";
import { runWrongImageRotationPrecheck } from "../orientation-preprocess";
import { createRotatedTempImage } from "../photo-analysis";
import { transformFacesToOriginalCoordinates } from "../face-rotation-check";


async function ensureEnabledAuxModelsForFaceDetection(
  settings: AppSettings["faceDetection"],
  enableOrientation: boolean,
): Promise<void> {
  const ensureOne = async (kind: AuxModelKind, modelId: AuxModelId) => {
    try {
      await ensureAuxModel(kind, modelId);
    } catch (error) {
      // Non-fatal: detection pipeline can continue without optional auxiliary models.
      // eslint-disable-next-line no-console
      console.warn(
        `[face-detection] optional aux model unavailable (${kind}/${modelId}):`,
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  if (enableOrientation) {
    await ensureOne("orientation", settings.imageOrientationDetection.model);
  }
  if (settings.faceLandmarkRefinement.enabled) {
    await ensureOne("landmarks", settings.faceLandmarkRefinement.model);
  }
  if (settings.faceAgeGenderDetection.enabled) {
    await ensureOne("age-gender", settings.faceAgeGenderDetection.model);
  }
}

function deriveOriginalDimensions(
  rotatedSize: { width: number; height: number } | null,
  angle: 90 | 180 | 270,
): { originalImageWidth: number; originalImageHeight: number } {
  if (!rotatedSize) {
    return { originalImageWidth: 0, originalImageHeight: 0 };
  }
  if (angle === 90 || angle === 270) {
    return { originalImageWidth: rotatedSize.height, originalImageHeight: rotatedSize.width };
  }
  return { originalImageWidth: rotatedSize.width, originalImageHeight: rotatedSize.height };
}

async function detectFacesUsingOrientationState(params: {
  imagePath: string;
  signal?: AbortSignal;
  settings?: AppSettings["faceDetection"];
  orientationAngleClockwise?: 0 | 90 | 180 | 270;
  enableRotationFallback?: boolean;
}): Promise<FaceDetectionOutput> {
  const { imagePath, signal, settings, orientationAngleClockwise, enableRotationFallback } = params;
  const detectOnRotatedCopy = async (angle: 90 | 180 | 270): Promise<FaceDetectionOutput> => {
    const rotated = await createRotatedTempImage(imagePath, angle);
    try {
      const { faces: rotatedFaces } = await detectFacesInPhotoWithOrientation({
        imagePath: rotated.path,
        signal,
        settings,
      });
      return transformFacesToOriginalCoordinates({
        faces: rotatedFaces,
        rotationAngleUsed: angle,
        ...deriveOriginalDimensions(rotatedFaces.imageSizeForBoundingBoxes, angle),
      });
    } finally {
      await rotated.cleanup();
    }
  };
  const hasKnownOrientation =
    orientationAngleClockwise === 90 ||
    orientationAngleClockwise === 180 ||
    orientationAngleClockwise === 270;
  const baseResult = hasKnownOrientation
    ? await detectOnRotatedCopy(orientationAngleClockwise)
    : (await detectFacesInPhotoWithOrientation({ imagePath, signal, settings })).faces;

  // Default behavior: single pass only (rotated when orientation is known, otherwise original).
  if (!enableRotationFallback || baseResult.faceCount > 0) {
    return baseResult;
  }

  // Optional fallback mode (kept for future settings toggle): try additional quarter turns.
  let best = baseResult;
  for (const angle of [90, 270, 180] as const) {
    if (orientationAngleClockwise === angle) continue;
    const candidate = await detectOnRotatedCopy(angle);
    if (candidate.faceCount > best.faceCount) {
      best = candidate;
    }
  }
  return best;
}

export function registerFaceDetectionHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.detectFolderFaces,
    async (event, request: DetectFolderFacesRequest) => {
      const serviceReady = await ensureFaceDetectionServiceRunning();
      if (!serviceReady) {
        const status = await getFaceDetectionServiceStatus();
        throw new Error(
          status.error ??
            "Face detection service is unavailable. Ensure ONNX models are downloaded.",
        );
      }

      const folderPath = request.folderPath?.trim();
      if (!folderPath) {
        throw new Error("Folder path is required for face detection");
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow) {
        throw new Error("Unable to locate face detection window");
      }

      const folders = request.recursive
        ? await collectFoldersRecursivelyWithProgress(folderPath)
        : [folderPath];

      const mode = request.mode === "missing" ? "missing" : "all";
      const skipPreviouslyFailed = request.skipPreviouslyFailed === true;
      const allSelectedImages: Array<{ path: string; name: string; folderPath: string }> = [];
      const initialItems: FaceDetectionItemState[] = [];
      const pendingCandidates: PipelineImageItem[] = [];
      const globallyFailedPaths = new Set<string>();

      for (const folder of folders) {
        let images: Awaited<ReturnType<typeof listFolderImages>>;
        try {
          images = await listFolderImages(folder);
        } catch (err) {
          console.warn(
            `[face-detection] listFolderImages failed for ${folder}: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        if (mode === "missing") {
          const imagePaths = images.map((image) => image.path);
          const inMemoryDetected = detectedFacesByFolder.get(folder) ?? new Set<string>();
          const persistedDetected = getAlreadyFaceDetectedPhotoPaths(
            folder,
            imagePaths,
          );
          const previouslyFailed = getFaceDetectionFailedPaths(imagePaths);
          for (const failedPath of previouslyFailed) {
            globallyFailedPaths.add(failedPath);
          }
          const previouslyDetected = new Set<string>([...inMemoryDetected, ...persistedDetected]);
          for (const image of images) {
            if (previouslyDetected.has(image.path)) continue;
            pendingCandidates.push({ path: image.path, name: image.name, folderPath: folder });
          }
        } else {
          const imagePaths = images.map((image) => image.path);
          const previouslyFailed = getFaceDetectionFailedPaths(imagePaths);
          for (const failedPath of previouslyFailed) {
            globallyFailedPaths.add(failedPath);
          }
          for (const image of images) {
            pendingCandidates.push({ path: image.path, name: image.name, folderPath: folder });
          }
        }
      }

      const orderedPending = orderPendingPipelineItems(
        pendingCandidates,
        globallyFailedPaths,
        skipPreviouslyFailed,
      );
      for (const item of orderedPending) {
        initialItems.push({
          path: item.path,
          name: item.name,
          status: "pending",
        });
        allSelectedImages.push(item);
      }

      await ensureCatalogForImagesWithProgress(initialItems.map((item) => item.path));

      const jobId = randomUUID();
      const job: RunningAnalysisJob = {
        cancelled: false,
        controllers: new Set<AbortController>(),
      };
      const powerSaveToken = acquirePowerSave(`face-detection:${folderPath}`);
      job.powerSaveToken = powerSaveToken;
      runningJobs.set(jobId, job);
      setFolderAnalysisInProgress(folderPath, "face", true);
      const faceJobContext: RunningFaceDetectionJobContext = {
        browserWindow,
        rootFolderPath: folderPath,
        itemsByPath: new Map(
          allSelectedImages.map((image) => [
            image.path,
            { name: image.name, folderPath: image.folderPath, status: "pending" as const },
          ]),
        ),
        completed: 0,
        failed: 0,
        cancelled: 0,
        elapsedTotalSeconds: 0,
        finalized: false,
        powerSaveToken,
      };
      runningFaceDetectionJobs.set(jobId, faceJobContext);

      emitFaceDetectionProgress(browserWindow, {
        type: "job-started",
        jobId,
        folderPath,
        total: initialItems.length,
        items: initialItems,
      });

      const concurrency = clampConcurrency(request.concurrency);
      const faceDetectionSettings =
        request.faceDetectionSettings ??
        (await readSettings(app.getPath("userData"))).faceDetection;
      const appSettings = await readSettings(app.getPath("userData"));

      void runFaceDetectionJob(
        browserWindow,
        jobId,
        folderPath,
        allSelectedImages,
        concurrency,
        faceDetectionSettings,
        appSettings,
        faceJobContext,
      ).finally(() => {
        if (job.powerSaveToken) {
          releasePowerSave(job.powerSaveToken);
          job.powerSaveToken = undefined;
        }
        runningJobs.delete(jobId);
        runningFaceDetectionJobs.delete(jobId);
      });

      return {
        jobId,
        total: initialItems.length,
      };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelFaceDetection, async (_event, jobId: string) => {
    const job = runningJobs.get(jobId);
    if (!job) {
      return false;
    }

    job.cancelled = true;
    job.controllers.forEach((controller) => {
      controller.abort();
    });
    const faceJobContext = runningFaceDetectionJobs.get(jobId);
    if (faceJobContext && !faceJobContext.finalized) {
      finalizeCancelledFaceDetectionJob(jobId, faceJobContext);
    }
    return true;
  });

  ipcMain.handle(
    IPC_CHANNELS.getFaceDetectionServiceStatus,
    async (): Promise<FaceDetectionServiceStatus> => {
      return getFaceDetectionServiceStatus();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.detectFacesForMediaItem,
    async (_event, sourcePath: string, faceDetectionSettings?: AppSettings["faceDetection"]) => {
      const imagePath = sourcePath?.trim();
      if (!imagePath) {
        throw new Error("Image path is required for local face detection");
      }

      const resolvedSettings =
        faceDetectionSettings ??
        (await readSettings(app.getPath("userData"))).faceDetection;
      const appSettings = await readSettings(app.getPath("userData"));
      await ensureEnabledAuxModelsForFaceDetection(
        resolvedSettings,
        appSettings.wrongImageRotationDetection.enabled,
      );

      await runWrongImageRotationPrecheck({
        imagePath,
        settings: appSettings,
      });
      const orientationState = getOrientationDetectionStateByPath(imagePath);

      const result = await detectFacesUsingOrientationState({
        imagePath,
        settings: resolvedSettings,
        orientationAngleClockwise: orientationState?.correctionAngleClockwise,
        enableRotationFallback: false,
      });
      const mediaId = upsertFaceDetectionResult(
        imagePath,
        result,
        undefined,
        resolvedSettings,
        orientationState
          ? {
              correctionAngleClockwise: orientationState.correctionAngleClockwise,
              confidence: orientationState.confidence ?? 0,
              model: resolvedSettings.imageOrientationDetection.model,
            }
          : null,
      );

      if (mediaId && result.faceCount > 0) {
        await autoChainEmbeddings(
          mediaId,
          imagePath,
          result,
          undefined,
          orientationState?.correctionAngleClockwise,
        );
      }

      return { success: true, faceCount: result.faceCount };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ensureDetectorModel,
    async (event, detectorModel: FaceDetectorModelId) => {
      if (process.env.EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD === "1") {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        const error = "Simulated face-model download failure (EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD=1)";
        try {
          senderWindow?.webContents.send(IPC_CHANNELS.faceModelDownloadProgress, {
            type: "started",
            filename: null,
            message: `Downloading face detector model (${detectorModel})...`,
            startedAtIso: new Date().toISOString(),
          } satisfies FaceModelDownloadProgressEvent);
          senderWindow?.webContents.send(IPC_CHANNELS.faceModelDownloadProgress, {
            type: "failed",
            durationMs: 0,
            error,
            message: `Failed to download face detector model (${detectorModel}).`,
          } satisfies FaceModelDownloadProgressEvent);
        } catch {
          // ignore disposed window
        }
        return { success: false, alreadyPresent: false, error };
      }
      if (isDetectorModelDownloaded(detectorModel)) {
        return { success: true, alreadyPresent: true };
      }
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const emit = (e: FaceModelDownloadProgressEvent) => {
        try {
          senderWindow?.webContents.send(IPC_CHANNELS.faceModelDownloadProgress, e);
        } catch {
          // ignore disposed window
        }
      };
      const startedAt = Date.now();
      emit({
        type: "started",
        filename: null,
        message: `Downloading face detector model (${detectorModel})...`,
        startedAtIso: new Date().toISOString(),
      });
      try {
        await ensureDetectorModel(detectorModel, (progress) => {
          emit({
            type: "progress",
            filename: progress.filename,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            percent: progress.percent,
            message: `Downloading face detector model (${detectorModel})...`,
          });
        });
        emit({
          type: "completed",
          durationMs: Date.now() - startedAt,
          message: `Face detector model (${detectorModel}) is ready.`,
        });
        return { success: true, alreadyPresent: false };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        emit({
          type: "failed",
          durationMs: Date.now() - startedAt,
          error,
          message: `Failed to download face detector model (${detectorModel}).`,
        });
        return { success: false, alreadyPresent: false, error };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ensureAuxModel,
    async (event, kind: AuxModelKind, modelId: AuxModelId) => {
      const label = `${kind} model (${modelId})`;
      if (process.env.EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD === "1") {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        const error = "Simulated face-model download failure (EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD=1)";
        try {
          senderWindow?.webContents.send(IPC_CHANNELS.faceModelDownloadProgress, {
            type: "started",
            filename: null,
            message: `Downloading ${label}...`,
            startedAtIso: new Date().toISOString(),
          } satisfies FaceModelDownloadProgressEvent);
          senderWindow?.webContents.send(IPC_CHANNELS.faceModelDownloadProgress, {
            type: "failed",
            durationMs: 0,
            error,
            message: `Failed to download ${label}.`,
          } satisfies FaceModelDownloadProgressEvent);
        } catch {
          // ignore disposed window
        }
        return { success: false, alreadyPresent: false, error };
      }
      if (isAuxModelDownloaded(kind, modelId)) {
        return { success: true, alreadyPresent: true };
      }
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const emit = (e: FaceModelDownloadProgressEvent) => {
        try {
          senderWindow?.webContents.send(IPC_CHANNELS.faceModelDownloadProgress, e);
        } catch {
          // ignore disposed window
        }
      };
      const startedAt = Date.now();
      emit({
        type: "started",
        filename: null,
        message: `Downloading ${label}...`,
        startedAtIso: new Date().toISOString(),
      });
      try {
        await ensureAuxModel(kind, modelId, (progress) => {
          emit({
            type: "progress",
            filename: progress.filename,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            percent: progress.percent,
            message: `Downloading ${label}...`,
          });
        });
        emit({
          type: "completed",
          durationMs: Date.now() - startedAt,
          message: `${label} is ready.`,
        });
        return { success: true, alreadyPresent: false };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        emit({
          type: "failed",
          durationMs: Date.now() - startedAt,
          error,
          message: `Failed to download ${label}.`,
        });
        return { success: false, alreadyPresent: false, error };
      }
    },
  );
}

function upsertDetectedFacePhoto(folderPath: string, photoPath: string): void {
  const current = detectedFacesByFolder.get(folderPath);
  if (current) {
    current.add(photoPath);
    return;
  }
  detectedFacesByFolder.set(folderPath, new Set([photoPath]));
}

function finalizeCancelledFaceDetectionJob(
  jobId: string,
  context: RunningFaceDetectionJobContext,
): void {
  if (context.finalized) {
    return;
  }
  context.finalized = true;

  let cancelledNow = 0;
  for (const item of context.itemsByPath.values()) {
    if (item.status === "settled") {
      continue;
    }
    item.status = "settled";
    cancelledNow += 1;
  }
  context.cancelled += cancelledNow;

  emitFaceDetectionProgress(context.browserWindow, {
    type: "job-completed",
    jobId,
    folderPath: context.rootFolderPath,
    completed: context.completed,
    failed: context.failed,
    cancelled: context.cancelled,
    averageSecondsPerFile:
      context.completed > 0 ? context.elapsedTotalSeconds / context.completed : 0,
  });
  setFolderAnalysisInProgress(context.rootFolderPath, "face", false);
  if (context.completed > 0 || context.failed > 0) {
    markFolderAnalyzed(context.rootFolderPath, "face");
  }
  if (context.powerSaveToken) {
    releasePowerSave(context.powerSaveToken);
    const job = runningJobs.get(jobId);
    if (job) {
      job.powerSaveToken = undefined;
    }
    context.powerSaveToken = undefined;
  }
}

async function runFaceDetectionJob(
  browserWindow: BrowserWindow,
  jobId: string,
  rootFolderPath: string,
  photos: Array<{ path: string; name: string; folderPath: string }>,
  concurrency: number,
  faceDetectionSettings: AppSettings["faceDetection"],
  appSettings: AppSettings,
  faceJobContext: RunningFaceDetectionJobContext,
): Promise<void> {
  const job = runningJobs.get(jobId);
  if (!job) {
    return;
  }

  let nextIndex = 0;

  const folderTotals = new Map<string, number>();
  const folderDone = new Map<string, number>();
  for (const photo of photos) {
    folderTotals.set(photo.folderPath, (folderTotals.get(photo.folderPath) ?? 0) + 1);
    folderDone.set(photo.folderPath, 0);
  }

  function markFolderDoneIfComplete(folderPath: string): void {
    const done = folderDone.get(folderPath) ?? 0;
    const total = folderTotals.get(folderPath) ?? 0;
    if (done >= total && total > 0) {
      markFolderAnalyzed(folderPath, "face");
    }
  }

  await ensureEnabledAuxModelsForFaceDetection(
    faceDetectionSettings,
    appSettings.wrongImageRotationDetection.enabled,
  );

  const runWorker = async (): Promise<void> => {
    while (true) {
      if (faceJobContext.finalized) {
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= photos.length) {
        return;
      }
      const photo = photos[currentIndex];

      const runtimeItem = faceJobContext.itemsByPath.get(photo.path);
      if (!runtimeItem || runtimeItem.status === "settled") {
        continue;
      }

      if (job.cancelled) {
        return;
      }
      runtimeItem.status = "running";

      emitFaceDetectionProgress(browserWindow, {
        type: "item-updated",
        jobId,
        currentFolderPath: photo.folderPath,
        item: {
          path: photo.path,
          name: photo.name,
          status: "running",
        },
      });

      const controller = new AbortController();
      job.controllers.add(controller);
      const startedAtMs = Date.now();

      try {
        await ensureMetadataForImage(photo.path);
        await runWrongImageRotationPrecheck({
          imagePath: photo.path,
          settings: appSettings,
          signal: controller.signal,
        });
        const orientationState = getOrientationDetectionStateByPath(photo.path);
        const result = await detectFacesUsingOrientationState({
          imagePath: photo.path,
          signal: controller.signal,
          settings: faceDetectionSettings,
          orientationAngleClockwise: orientationState?.correctionAngleClockwise,
          enableRotationFallback: false,
        });
        if (faceJobContext.finalized || job.cancelled) {
          return;
        }
        const elapsedSeconds = (Date.now() - startedAtMs) / 1000;

        faceJobContext.completed += 1;
        faceJobContext.elapsedTotalSeconds += elapsedSeconds;
        runtimeItem.status = "settled";
        folderDone.set(photo.folderPath, (folderDone.get(photo.folderPath) ?? 0) + 1);
        upsertDetectedFacePhoto(photo.folderPath, photo.path);
        const mediaId = upsertFaceDetectionResult(
          photo.path,
          result,
          undefined,
          faceDetectionSettings,
          orientationState
            ? {
                correctionAngleClockwise: orientationState.correctionAngleClockwise,
                confidence: orientationState.confidence ?? 0,
                model: faceDetectionSettings.imageOrientationDetection.model,
              }
            : null,
        );
        if (mediaId) {
          appendSyncOperation({
            mediaId,
            operationType: "media.ai.annotate",
            payload: {
              analysisType: "face_detection",
              faceCount: result.faceCount,
              sourcePath: photo.path,
              completedAt: new Date().toISOString(),
            },
          });

          if (result.faceCount > 0 && !job.cancelled) {
            await autoChainEmbeddings(
              mediaId,
              photo.path,
              result,
              controller.signal,
              orientationState?.correctionAngleClockwise,
            );
          }
        }
        emitFaceDetectionProgress(browserWindow, {
          type: "item-updated",
          jobId,
          currentFolderPath: photo.folderPath,
          item: {
            path: photo.path,
            name: photo.name,
            status: "success",
            elapsedSeconds,
            result,
          },
        });
        markFolderDoneIfComplete(photo.folderPath);
      } catch (error) {
        const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown face detection error";
        console.log(
          `[emk-face-debug][job] itemFailed path=${photo.path} elapsedSec=${elapsedSeconds.toFixed(2)} error=${JSON.stringify(errorMessage)} cancelled=${job.cancelled}`,
        );

        if (job.cancelled) {
          return;
        }

        faceJobContext.failed += 1;
        runtimeItem.status = "settled";
        folderDone.set(photo.folderPath, (folderDone.get(photo.folderPath) ?? 0) + 1);
        markFaceDetectionFailed(photo.path, errorMessage);
        emitFaceDetectionProgress(browserWindow, {
          type: "item-updated",
          jobId,
          currentFolderPath: photo.folderPath,
          item: {
            path: photo.path,
            name: photo.name,
            status: "failed",
            elapsedSeconds,
            error: errorMessage,
          },
        });
        markFolderDoneIfComplete(photo.folderPath);
      } finally {
        job.controllers.delete(controller);
      }
    }
  };

  const workerCount = Math.min(concurrency, Math.max(1, photos.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  if (faceJobContext.finalized) {
    return;
  }

  for (const folderPath of folderTotals.keys()) {
    markFolderDoneIfComplete(folderPath);
  }

  emitFaceDetectionProgress(browserWindow, {
    type: "job-completed",
    jobId,
    folderPath: rootFolderPath,
    completed: faceJobContext.completed,
    failed: faceJobContext.failed,
    cancelled: faceJobContext.cancelled,
    averageSecondsPerFile:
      faceJobContext.completed > 0
        ? faceJobContext.elapsedTotalSeconds / faceJobContext.completed
        : 0,
  });
  faceJobContext.finalized = true;
  setFolderAnalysisInProgress(rootFolderPath, "face", false);
  if (faceJobContext.completed > 0 || faceJobContext.failed > 0) {
    markFolderAnalyzed(rootFolderPath, "face");
  }
  if (faceJobContext.powerSaveToken) {
    releasePowerSave(faceJobContext.powerSaveToken);
    const job = runningJobs.get(jobId);
    if (job) {
      job.powerSaveToken = undefined;
    }
    faceJobContext.powerSaveToken = undefined;
  }
}
