import { randomUUID } from "node:crypto";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  estimateRotationFromFaceLandmarks,
  type FaceLandmarkRotationResult,
} from "@emk/shared-contracts";
import {
  IPC_CHANNELS,
  type AppSettings,
  type DetectFolderFacesRequest,
  type FaceDetectionOutput,
  type FaceDetectionItemState,
  type FaceDetectionServiceStatus,
  type ImageRotationProgressEvent,
} from "../../src/shared/ipc";
import { listFolderImages } from "../fs-media";
import { detectFacesInPhotoWithOrientation } from "../face-detection";
import { readSettings } from "../storage";
import {
  getAlreadyFaceDetectedPhotoPaths,
  getFaceDetectionFailedPaths,
  getOrientationDetectionStateByPath,
  markFaceDetectionFailed,
  upsertOrientationDetectionFailure,
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
  runningImageRotationJobs,
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

interface OrientedFaceDetectionResult {
  faces: FaceDetectionOutput;
  embeddingOverride?: {
    imagePath: string;
    faces: FaceDetectionOutput;
    cleanup: () => Promise<void>;
  };
}

async function detectFacesUsingOrientationState(params: {
  imagePath: string;
  signal?: AbortSignal;
  settings?: AppSettings["faceDetection"];
  orientationAngleClockwise?: 0 | 90 | 180 | 270;
  enableRotationFallback?: boolean;
}): Promise<OrientedFaceDetectionResult> {
  const { imagePath, signal, settings, orientationAngleClockwise, enableRotationFallback } = params;
  const detectOnRotatedCopy = async (angle: 90 | 180 | 270): Promise<OrientedFaceDetectionResult> => {
    const rotated = await createRotatedTempImage(imagePath, angle);
    const { faces: rotatedFaces } = await detectFacesInPhotoWithOrientation({
      imagePath: rotated.path,
      signal,
      settings,
    });
    return {
      faces: transformFacesToOriginalCoordinates({
        faces: rotatedFaces,
        rotationAngleUsed: angle,
        ...deriveOriginalDimensions(rotatedFaces.imageSizeForBoundingBoxes, angle),
      }),
      embeddingOverride: {
        imagePath: rotated.path,
        faces: rotatedFaces,
        cleanup: rotated.cleanup,
      },
    };
  };
  const hasKnownOrientation =
    orientationAngleClockwise === 90 ||
    orientationAngleClockwise === 180 ||
    orientationAngleClockwise === 270;
  const baseDetection = hasKnownOrientation
    ? await detectOnRotatedCopy(orientationAngleClockwise)
    : {
        faces: (await detectFacesInPhotoWithOrientation({ imagePath, signal, settings })).faces,
      };
  const baseResult = baseDetection.faces;

  // Optional expensive orientation correction pass. Keep this behind
  // `enableRotationFallback` so standard detection (especially manual folder
  // "Detect faces") stays single-pass and predictable.
  if (enableRotationFallback) {
    // Safety net: if detected landmarks still indicate non-upright orientation,
    // run one corrective pass to align by landmarks-based correction.
    const landmarkCorrection = hasKnownOrientation ? null : inferLandmarkCorrection(baseResult);
    if (landmarkCorrection !== null) {
      const currentAppliedAngle = hasKnownOrientation ? orientationAngleClockwise : 0;
      const combined = (currentAppliedAngle + landmarkCorrection) % 360;
      if (combined === 0) {
        return {
          faces: (await detectFacesInPhotoWithOrientation({ imagePath, signal, settings })).faces,
        };
      }
      if (combined === 90 || combined === 180 || combined === 270) {
        return detectOnRotatedCopy(combined);
      }
    }

    // If orientation is still unknown and landmarks are ambiguous, probe
    // quarter turns and pick the most upright high-confidence candidate.
    if (!hasKnownOrientation && baseResult.faceCount > 0) {
      const best = await chooseBestUprightRotationByLandmarks({
        imagePath,
        signal,
        settings,
        baseResult,
        detectOnRotatedCopy,
      });
      if (best) {
        return best;
      }
    }
  }

  // Default behavior: single pass only (rotated when orientation is known, otherwise original).
  if (!enableRotationFallback || baseResult.faceCount > 0) {
    return baseDetection;
  }

  // Optional fallback mode (kept for future settings toggle): try additional quarter turns.
  let best = baseDetection;
  for (const angle of [90, 270, 180] as const) {
    if (orientationAngleClockwise === angle) continue;
    const candidate = await detectOnRotatedCopy(angle);
    if (candidate.faces.faceCount > best.faces.faceCount) {
      best = candidate;
    }
  }
  return best;
}

function inferLandmarkCorrection(
  faces: FaceDetectionOutput,
): 90 | 180 | 270 | null {
  if (!Array.isArray(faces.faces) || faces.faces.length === 0) {
    return null;
  }
  const landmarks = faces.faces
    .map((face) => ({
      landmarks: face.landmarks_5,
      score: face.score,
    }))
    .filter(
      (entry): entry is { landmarks: [number, number][]; score: number } =>
        Array.isArray(entry.landmarks) && entry.landmarks.length >= 5,
    );
  if (landmarks.length === 0) {
    return null;
  }
  const result = estimateLandmarkRotation(faces);
  if (!result) {
    return null;
  }
  const isStrongSignal =
    result.confidence >= 0.4 &&
    result.faceCount >= 1 &&
    (result.unanimousAgreement || result.faceCount === 1);
  if (!isStrongSignal) {
    return null;
  }
  const correction = result.correctionAngleClockwise;
  if (correction === 90 || correction === 180 || correction === 270) {
    return correction;
  }
  return null;
}

function estimateLandmarkRotation(
  faces: FaceDetectionOutput,
): FaceLandmarkRotationResult | null {
  if (!Array.isArray(faces.faces) || faces.faces.length === 0) {
    return null;
  }
  const landmarks = faces.faces
    .map((face) => ({
      landmarks: face.landmarks_5,
      score: face.score,
    }))
    .filter(
      (entry): entry is { landmarks: [number, number][]; score: number } =>
        Array.isArray(entry.landmarks) && entry.landmarks.length >= 5,
    );
  if (landmarks.length === 0) {
    return null;
  }
  return estimateRotationFromFaceLandmarks(landmarks);
}

async function chooseBestUprightRotationByLandmarks(params: {
  imagePath: string;
  signal?: AbortSignal;
  settings?: AppSettings["faceDetection"];
  baseResult: FaceDetectionOutput;
  detectOnRotatedCopy: (angle: 90 | 180 | 270) => Promise<OrientedFaceDetectionResult>;
}): Promise<(OrientedFaceDetectionResult & { angle: 0 | 90 | 180 | 270 }) | null> {
  const { baseResult, detectOnRotatedCopy } = params;
  const candidates: Array<OrientedFaceDetectionResult & { angle: 0 | 90 | 180 | 270 }> = [
    { angle: 0, faces: baseResult },
  ];
  for (const angle of [90, 180, 270] as const) {
    candidates.push({ angle, ...(await detectOnRotatedCopy(angle)) });
  }

  const scored = candidates
    .map((candidate) => {
      const rotation = estimateLandmarkRotation(candidate.faces);
      return {
        ...candidate,
        rotation,
      };
    })
    .filter((entry) => entry.faces.faceCount > 0);

  if (scored.length === 0) {
    return null;
  }

  const upright = scored
    .filter(
      (entry) =>
        entry.rotation?.orientation === "upright" &&
        entry.rotation.confidence >= 0.35,
    )
    .sort((a, b) => {
      const conf = (b.rotation?.confidence ?? 0) - (a.rotation?.confidence ?? 0);
      if (conf !== 0) return conf;
      return b.faces.faceCount - a.faces.faceCount;
    })[0];

  if (!upright) {
    return null;
  }
  return { angle: upright.angle, faces: upright.faces };
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
        kind: "face-detection",
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
    IPC_CHANNELS.detectFolderImageRotation,
    async (event, request: { folderPath: string; recursive?: boolean; mode?: "missing" | "all" }): Promise<{ jobId: string; total: number }> => {
      const folderPath = request.folderPath?.trim();
      if (!folderPath) {
        throw new Error("Folder path is required for image rotation detection");
      }
      const jobId = randomUUID();
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const emit = (payload: ImageRotationProgressEvent): void => {
        senderWindow?.webContents.send(IPC_CHANNELS.imageRotationProgress, payload);
      };
      const folders = request.recursive === true
        ? await collectFoldersRecursivelyWithProgress(folderPath)
        : [folderPath];
      const imagesByFolder = await Promise.all(folders.map((folder) => listFolderImages(folder)));
      const imagePaths = imagesByFolder.flat().map((image) => image.path);
      runningImageRotationJobs.set(jobId, { cancelled: false, folderPath });
      emit({ type: "job-started", jobId, folderPath, total: imagePaths.length });

      void (async () => {
        try {
          await ensureCatalogForImagesWithProgress(imagePaths);

          const savedSettings = await readSettings(app.getPath("userData"));
          const rotationSettings: AppSettings = {
            ...savedSettings,
            wrongImageRotationDetection: {
              ...savedSettings.wrongImageRotationDetection,
              enabled: true,
            },
          };

          let processed = 0;
          let wronglyRotated = 0;
          let skipped = 0;
          let failed = 0;
          const force = request.mode === "all";
          for (const imagePath of imagePaths) {
            if (runningImageRotationJobs.get(jobId)?.cancelled) {
              emit({ type: "job-cancelled", jobId, folderPath, processed: processed + skipped + failed, total: imagePaths.length, wronglyRotated, skipped, failed });
              return;
            }
            let result: "processed" | "skipped" | "failed" | "disabled";
            try {
              result = await runWrongImageRotationPrecheck({ imagePath, settings: rotationSettings, force });
            } catch (error) {
              result = "failed";
              upsertOrientationDetectionFailure(
                imagePath,
                error instanceof Error ? error.message : String(error),
              );
            }
            if (runningImageRotationJobs.get(jobId)?.cancelled) {
              emit({ type: "job-cancelled", jobId, folderPath, processed: processed + skipped + failed, total: imagePaths.length, wronglyRotated, skipped, failed });
              return;
            }
            const state = getOrientationDetectionStateByPath(imagePath);
            if (result === "skipped") {
              skipped += 1;
            } else if (result === "processed" && state) {
              processed += 1;
            } else if (result === "failed" || result === "disabled" || !state) {
              failed += 1;
              upsertOrientationDetectionFailure(imagePath, result === "disabled" ? "Image rotation detection is disabled" : "No orientation result was produced");
            }
            if (state && [90, 180, 270].includes(state.correctionAngleClockwise)) {
              wronglyRotated += 1;
            }
            emit({ type: "progress", jobId, folderPath, processed: processed + skipped + failed, total: imagePaths.length, wronglyRotated, skipped, failed });
          }
          emit({ type: "job-completed", jobId, folderPath, processed: processed + skipped + failed, total: imagePaths.length, wronglyRotated, skipped, failed });
        } catch (error) {
          emit({
            type: "job-failed",
            jobId,
            folderPath,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          runningImageRotationJobs.delete(jobId);
        }
      })();

      return { jobId, total: imagePaths.length };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelImageRotationDetection, async (_event, jobId: string) => {
    const job = runningImageRotationJobs.get(jobId);
    if (!job) {
      return false;
    }
    job.cancelled = true;
    return true;
  });

  ipcMain.handle(
    IPC_CHANNELS.detectFacesForMediaItem,
    async (_event, sourcePath: string, faceDetectionSettings?: AppSettings["faceDetection"]) => {
      const perfLog = process.env.EMK_FACE_PERF_LOG === "1";
      const skipAutoEmbed = process.env.EMK_FACE_SKIP_AUTO_EMBED === "1";
      const perfStarted = perfLog ? performance.now() : 0;
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

      const precheckStarted = perfLog ? performance.now() : 0;
      await runWrongImageRotationPrecheck({
        imagePath,
        settings: appSettings,
      });
      const precheckMs = perfLog ? performance.now() - precheckStarted : 0;
      const orientationState = getOrientationDetectionStateByPath(imagePath);

      const detectStarted = perfLog ? performance.now() : 0;
      const detection = await detectFacesUsingOrientationState({
        imagePath,
        settings: resolvedSettings,
        orientationAngleClockwise: orientationState?.correctionAngleClockwise,
        enableRotationFallback: false,
      });
      const detectMs = perfLog ? performance.now() - detectStarted : 0;
      const result = detection.faces;
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

      const embedStarted = perfLog ? performance.now() : 0;
      if (mediaId && result.faceCount > 0 && !skipAutoEmbed) {
        await autoChainEmbeddings(
          mediaId,
          imagePath,
          result,
          undefined,
          orientationState?.correctionAngleClockwise,
          detection.embeddingOverride,
        );
      }
      const embedMs = perfLog ? performance.now() - embedStarted : 0;

      const debugTimings = perfLog
        ? {
            totalMs: Math.round(performance.now() - perfStarted),
            precheckMs: Math.round(precheckMs),
            detectMs: Math.round(detectMs),
            embedMs: Math.round(embedMs),
          }
        : undefined;

      if (perfLog && debugTimings) {
        const totalMs = performance.now() - perfStarted;
        console.log(
          `[face-perf] file=${imagePath} faces=${result.faceCount} totalMs=${totalMs.toFixed(0)} precheckMs=${precheckMs.toFixed(0)} detectMs=${detectMs.toFixed(0)} embedMs=${embedMs.toFixed(0)}`,
        );
      }

      return {
        success: true,
        faceCount: result.faceCount,
        ...(debugTimings ? { debugTimings } : {}),
      };
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
  const skipAutoEmbed = process.env.EMK_FACE_SKIP_AUTO_EMBED === "1";
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
        const detection = await detectFacesUsingOrientationState({
          imagePath: photo.path,
          signal: controller.signal,
          settings: faceDetectionSettings,
          orientationAngleClockwise: orientationState?.correctionAngleClockwise,
          enableRotationFallback: false,
        });
        const result = detection.faces;
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

          if (result.faceCount > 0 && !job.cancelled && !skipAutoEmbed) {
            await autoChainEmbeddings(
              mediaId,
              photo.path,
              result,
              controller.signal,
              orientationState?.correctionAngleClockwise,
              detection.embeddingOverride,
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
