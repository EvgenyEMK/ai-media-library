import { randomUUID } from "node:crypto";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  IPC_CHANNELS,
  type AnalyzeFolderPhotosRequest,
  type PhotoAnalysisItemState,
  type PhotoAnalysisOutput,
} from "../../src/shared/ipc";
import { listFolderImages } from "../fs-media";
import { getDefaultVisionModel } from "../photo-analysis";
import { warmupOllamaVisionModel } from "../photo-analysis";
import { analyzePhotoWithOptionalTwoPass, getPrimaryRotateAngle } from "../photo-analysis-pipeline";
import { readSettings } from "../storage";
import {
  getAlreadyAnalyzedPhotoPaths,
  getPhotoAnalysisFailedPaths,
  markPhotoAnalysisFailed,
  upsertPhotoAnalysisResult,
  upsertRotationPipelineFaces,
} from "../db/media-analysis";
import {
  markFolderAnalyzed,
  setFolderAnalysisInProgress,
} from "../db/folder-analysis-status";
import { appendSyncOperation } from "../db/sync-log";
import { buildCaptionText } from "../db/media-analysis";
import { embedTextForDocument } from "../nomic-vision-embedder";
import { MULTIMODAL_EMBED_MODEL } from "../semantic-embeddings";
import { ensureFaceDetectionServiceRunning } from "../face-service";
import { emitPhotoProgress } from "./progress-emitters";
import { runningJobs, analyzedPhotosByFolder, vectorStore } from "./state";
import type { RunningAnalysisJob } from "./types";
import { collectFoldersRecursively, clampConcurrency, ensureCatalogForImages, ensureMetadataForImage } from "./folder-utils";
import { acquirePowerSave, releasePowerSave } from "./power-save-manager";
import { orderPendingPipelineItems, type PipelineImageItem } from "./pipeline-item-order";

function ts(): string {
  return new Date().toISOString();
}
function isDebugEnabled(): boolean {
  return process.env.EMK_DEBUG_PHOTO_AI === "1";
}

export function registerPhotoAnalysisHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.analyzeFolderPhotos,
    async (event, request: AnalyzeFolderPhotosRequest) => {
      const folderPath = request.folderPath?.trim();
      if (!folderPath) {
        throw new Error("Folder path is required for photo analysis");
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow) {
        throw new Error("Unable to locate analysis window");
      }

      const folders = request.recursive
        ? await collectFoldersRecursively(folderPath)
        : [folderPath];

      const mode = request.mode === "missing" ? "missing" : "all";
      const skipPreviouslyFailed = request.skipPreviouslyFailed === true;
      const selectedImages: Array<{ path: string; name: string; folderPath: string }> = [];
      const initialItems: PhotoAnalysisItemState[] = [];
      const pendingCandidates: PipelineImageItem[] = [];
      const globallyFailedPaths = new Set<string>();

      for (const folder of folders) {
        let images: Awaited<ReturnType<typeof listFolderImages>>;
        try {
          images = await listFolderImages(folder);
        } catch (err) {
          console.warn(
            `[photo-analysis] listFolderImages failed for ${folder}: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        if (mode === "missing") {
          const imagePaths = images.map((image) => image.path);
          const inMemoryAnalyzed = analyzedPhotosByFolder.get(folder) ?? new Set<string>();
          const persistedAnalyzed = getAlreadyAnalyzedPhotoPaths(
            folder,
            imagePaths,
          );
          const previouslyFailed = getPhotoAnalysisFailedPaths(imagePaths);
          for (const failedPath of previouslyFailed) {
            globallyFailedPaths.add(failedPath);
          }
          const previouslyAnalyzed = new Set<string>([...inMemoryAnalyzed, ...persistedAnalyzed]);
          for (const image of images) {
            if (previouslyAnalyzed.has(image.path)) continue;
            pendingCandidates.push({ path: image.path, name: image.name, folderPath: folder });
          }
        } else {
          const imagePaths = images.map((image) => image.path);
          const previouslyFailed = getPhotoAnalysisFailedPaths(imagePaths);
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
        selectedImages.push(item);
      }

      ensureCatalogForImages(initialItems.map((item) => item.path));

      const jobId = randomUUID();
      const job: RunningAnalysisJob = {
        cancelled: false,
        controllers: new Set<AbortController>(),
      };
      job.rootFolderPath = folderPath;
      const powerSaveToken = acquirePowerSave(`photo-analysis:${folderPath}`);
      job.powerSaveToken = powerSaveToken;
      runningJobs.set(jobId, job);
      setFolderAnalysisInProgress(folderPath, "photo", true);

      const model = request.model?.trim() || getDefaultVisionModel();
      const think = request.think;
      const timeoutMsPerImage =
        typeof request.timeoutMsPerImage === "number" &&
        Number.isFinite(request.timeoutMsPerImage) &&
        request.timeoutMsPerImage > 0
          ? Math.round(request.timeoutMsPerImage)
          : undefined;

      emitPhotoProgress(browserWindow, {
        type: "job-started",
        jobId,
        folderPath,
        total: initialItems.length,
        items: initialItems,
      });
      emitPhotoProgress(browserWindow, {
        type: "phase-updated",
        jobId,
        phase: "initializing-model",
      });
      if (isDebugEnabled()) {
        console.log(
          `[photo-ai][main][${ts()}] job-started jobId=${jobId} folder="${folderPath}" total=${initialItems.length} model="${model}"`,
        );
      }
      const savedSettings = await readSettings(app.getPath("userData"));
      const enableTwoPassRotationConsistency =
        typeof request.enableTwoPassRotationConsistency === "boolean"
          ? request.enableTwoPassRotationConsistency
          : savedSettings.photoAnalysis.enableTwoPassRotationConsistency;
      const useFaceFeaturesForRotation =
        typeof request.useFaceFeaturesForRotation === "boolean"
          ? request.useFaceFeaturesForRotation
          : savedSettings.photoAnalysis.useFaceFeaturesForRotation;
      const extractInvoiceData =
        typeof request.extractInvoiceData === "boolean"
          ? request.extractInvoiceData
          : savedSettings.photoAnalysis.extractInvoiceData;
      const downscaleBeforeLlm =
        typeof request.downscaleBeforeLlm === "boolean"
          ? request.downscaleBeforeLlm
          : savedSettings.photoAnalysis.downscaleBeforeLlm;
      const downscaleLongestSidePx =
        typeof request.downscaleLongestSidePx === "number" &&
        Number.isFinite(request.downscaleLongestSidePx) &&
        request.downscaleLongestSidePx > 0
          ? Math.round(request.downscaleLongestSidePx)
          : savedSettings.photoAnalysis.downscaleLongestSidePx;
      const concurrency = clampConcurrency(request.concurrency);

      if (useFaceFeaturesForRotation) {
        await ensureFaceDetectionServiceRunning();
      }

      void (async () => {
        const current = runningJobs.get(jobId);
        if (!current || current.cancelled) return;

        current.warmupController = new AbortController();
        try {
          if (isDebugEnabled()) {
            console.log(
              `[photo-ai][main][${ts()}] warmup START jobId=${jobId} model="${model}"`,
            );
          }
          await warmupOllamaVisionModel({
            model,
            timeoutMs: 90_000,
            signal: current.warmupController.signal,
          });
          emitPhotoProgress(browserWindow, {
            type: "phase-updated",
            jobId,
            phase: "analyzing",
          });
          if (isDebugEnabled()) {
            console.log(
              `[photo-ai][main][${ts()}] warmup OK jobId=${jobId} model="${model}"`,
            );
          }
        } catch (error) {
          if (isDebugEnabled()) {
            console.log(
              `[photo-ai][main][${ts()}] warmup FAILED jobId=${jobId} model="${model}" error="${error instanceof Error ? error.message : String(error)}"`,
            );
          }
          // If the user cancels during warmup, do not treat it as a fatal/unhandled error.
          if (current.cancelled || (error instanceof Error && error.message === "Warmup cancelled")) {
            emitPhotoProgress(browserWindow, {
              type: "job-completed",
              jobId,
              folderPath,
              completed: 0,
              failed: 0,
              cancelled: selectedImages.length,
              averageSecondsPerFile: 0,
            });
            if (isDebugEnabled()) {
              console.log(
                `[photo-ai][main][${ts()}] job-completed (warmup-cancelled) jobId=${jobId} completed=0 failed=0 cancelled=${selectedImages.length} durationMs=0`,
              );
            }
            return;
          }
          throw error;
        } finally {
          current.warmupController = undefined;
        }

        if (current.cancelled) return;

        await runPhotoAnalysisJob(
          browserWindow,
          jobId,
          folderPath,
          selectedImages,
          model,
          think,
          timeoutMsPerImage,
          enableTwoPassRotationConsistency,
          useFaceFeaturesForRotation,
          extractInvoiceData,
          downscaleBeforeLlm,
          downscaleLongestSidePx,
          concurrency,
        );
      })().finally(() => {
        if (job.powerSaveToken) {
          releasePowerSave(job.powerSaveToken);
          job.powerSaveToken = undefined;
        }
        runningJobs.delete(jobId);
      });

      return {
        jobId,
        total: initialItems.length,
      };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelPhotoAnalysis, async (_event, jobId: string) => {
    if (isDebugEnabled()) {
      console.log(`[photo-ai][main][${ts()}] cancel request jobId=${jobId}`);
    }
    const job = runningJobs.get(jobId);
    if (!job) {
      if (isDebugEnabled()) {
        console.log(`[photo-ai][main][${ts()}] cancel ignored (job not found) jobId=${jobId}`);
      }
      return false;
    }

    job.cancelled = true;
    job.warmupController?.abort();
    if (isDebugEnabled()) {
      console.log(
        `[photo-ai][main][${ts()}] cancelling jobId=${jobId} controllers=${job.controllers.size} rootFolder="${job.rootFolderPath ?? ""}"`,
      );
    }
    job.controllers.forEach((controller) => {
      controller.abort();
    });
    if (job.powerSaveToken) {
      releasePowerSave(job.powerSaveToken);
      job.powerSaveToken = undefined;
    }
    if (job.rootFolderPath) {
      setFolderAnalysisInProgress(job.rootFolderPath, "photo", false);
    }
    return true;
  });
}

function upsertAnalyzedPhoto(folderPath: string, photoPath: string): void {
  const current = analyzedPhotosByFolder.get(folderPath);
  if (current) {
    current.add(photoPath);
    return;
  }
  analyzedPhotosByFolder.set(folderPath, new Set([photoPath]));
}

async function runPhotoAnalysisJob(
  browserWindow: BrowserWindow,
  jobId: string,
  rootFolderPath: string,
  photos: Array<{ path: string; name: string; folderPath: string }>,
  model: string,
  think: boolean | undefined,
  timeoutMsPerImage: number | undefined,
  enableTwoPassRotationConsistency: boolean,
  useFaceFeaturesForRotation: boolean,
  extractInvoiceData: boolean,
  downscaleBeforeLlm: boolean,
  downscaleLongestSidePx: number,
  concurrency: number,
): Promise<void> {
  const job = runningJobs.get(jobId);
  if (!job) {
    return;
  }
  const startedAtMs = Date.now();

  let nextIndex = 0;
  let completed = 0;
  let failed = 0;
  let cancelled = 0;
  let elapsedTotalSeconds = 0;

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
      markFolderAnalyzed(folderPath, "photo");
    }
  }

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= photos.length) {
        return;
      }

      const photo = photos[currentIndex];

      if (job.cancelled) {
        return;
      }

      emitPhotoProgress(browserWindow, {
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
        const { output: result, rotationDecision } = await analyzePhotoWithOptionalTwoPass({
          imagePath: photo.path,
          model,
          think,
          timeoutMs: timeoutMsPerImage,
          signal: controller.signal,
          downscaleBeforeLlm,
          downscaleLongestSidePx,
          enableTwoPassRotationConsistency,
          useFaceFeaturesForRotation,
          extractInvoiceData,
          onRotationPipelineFacesDetected: (imgPath, faces) => {
            upsertRotationPipelineFaces(imgPath, faces);
          },
        });
        const elapsedSeconds = (Date.now() - startedAtMs) / 1000;

        completed += 1;
        elapsedTotalSeconds += elapsedSeconds;
        const savedRotation = getPrimaryRotateAngle(result);
        if (savedRotation || rotationDecision.tier !== "none") {
          const photoName = photo.path.split(/[\\/]/).pop() ?? photo.path;
          // console.log(
          //   `[face-rotation] SAVING "${photoName}": finalRotation=${savedRotation ?? 0}` +
          //   ` tier=${rotationDecision.tier} faceInDb=${rotationDecision.faceDetectedInDb}` +
          //   ` vlm1st=${rotationDecision.vlmFirstPassAngle ?? "-"}`,
          // );
        }
        const resultWithDecision: PhotoAnalysisOutput = {
          ...result,
          rotation_decision: rotationDecision,
        };
        upsertAnalyzedPhoto(photo.folderPath, photo.path);
        const mediaId = upsertPhotoAnalysisResult(photo.path, resultWithDecision);
        if (mediaId) {
          appendSyncOperation({
            mediaId,
            operationType: "media.ai.annotate",
            payload: {
              analysisType: "photo",
              model,
              sourcePath: photo.path,
              completedAt: new Date().toISOString(),
            },
          });

          // Generate description text embedding (fast, ~5-10ms)
          try {
            const captionText = buildCaptionText(result);
            if (captionText.length > 0) {
              const descVector = await embedTextForDocument(captionText);
              vectorStore.upsertEmbedding({
                mediaItemId: mediaId,
                embeddingType: "text",
                embeddingSource: "ai_metadata",
                modelVersion: MULTIMODAL_EMBED_MODEL,
                vector: descVector,
              });
            }
          } catch (descErr) {
            const reason = descErr instanceof Error ? descErr.message : String(descErr);
            console.warn(`[photo-ai] description embedding failed for ${photo.name}: ${reason}`);
          }
        }
        folderDone.set(photo.folderPath, (folderDone.get(photo.folderPath) ?? 0) + 1);
        emitPhotoProgress(browserWindow, {
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
          error instanceof Error ? error.message : "Unknown analysis error";
        console.error(
          `[photo-ai][failed] file="${photo.path}" name="${photo.name}" model="${model}" reason="${errorMessage}"`,
        );

        folderDone.set(photo.folderPath, (folderDone.get(photo.folderPath) ?? 0) + 1);
        if (job.cancelled) {
          cancelled += 1;
          emitPhotoProgress(browserWindow, {
            type: "item-updated",
            jobId,
            currentFolderPath: photo.folderPath,
            item: {
              path: photo.path,
              name: photo.name,
              status: "cancelled",
              elapsedSeconds,
              error: "Cancelled by user",
            },
          });
        } else {
          failed += 1;
          markPhotoAnalysisFailed(photo.path, errorMessage);
          emitPhotoProgress(browserWindow, {
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
        }
        markFolderDoneIfComplete(photo.folderPath);
      } finally {
        job.controllers.delete(controller);
      }
    }
  };

  const workerCount = Math.min(concurrency, Math.max(1, photos.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  if (job.cancelled) {
    cancelled = Math.max(0, photos.length - completed - failed);
  }

  emitPhotoProgress(browserWindow, {
    type: "job-completed",
    jobId,
    folderPath: rootFolderPath,
    completed,
    failed,
    cancelled,
    averageSecondsPerFile: completed > 0 ? elapsedTotalSeconds / completed : 0,
  });
  setFolderAnalysisInProgress(rootFolderPath, "photo", false);
  if (completed > 0 || failed > 0) {
    markFolderAnalyzed(rootFolderPath, "photo");
  }
  if (isDebugEnabled()) {
    console.log(
      `[photo-ai][main][${ts()}] job-completed jobId=${jobId} completed=${completed} failed=${failed} cancelled=${cancelled} durationMs=${Date.now() - startedAtMs}`,
    );
  }
}
