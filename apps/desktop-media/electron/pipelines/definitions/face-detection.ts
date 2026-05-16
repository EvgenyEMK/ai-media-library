import { app } from "electron";
import type { PipelineDefinition } from "../pipeline-registry";
import type { FaceDetectionOutput } from "../../../src/shared/ipc";
import { listFolderImages } from "../../fs-media";
import {
  collectFoldersRecursivelyWithProgress,
  ensureCatalogForImagesWithProgress,
  ensureMetadataForImage,
} from "../../ipc/folder-utils";
import {
  getAlreadyFaceDetectedPhotoPaths,
  getFaceDetectionFailedPaths,
  getOrientationDetectionStateByPath,
  markFaceDetectionFailed,
  upsertFaceDetectionResult,
} from "../../db/media-analysis";
import { getFacesNeedingEmbeddings } from "../../db/face-embeddings";
import { DEFAULT_LIBRARY_ID } from "../../db/folder-analysis-status";
import { readSettings } from "../../storage";
import { runWrongImageRotationPrecheck } from "../../orientation-preprocess";
import { detectFacesUsingOrientationState } from "../../ipc/face-detection-handlers";
import { appendSyncOperation } from "../../db/sync-log";
import { orderPendingPipelineItems, type PipelineImageItem } from "../../ipc/pipeline-item-order";
import { ensureFaceDetectionServiceRunning } from "../../face-service";
import {
  embedFacesForMediaItem,
  ensureFaceEmbeddingModelLoaded,
} from "../../face-embed-for-media-item";
import { embedFaceEmbeddingJobsByImage } from "../../face-embedding-batch";
import { refreshPersonSuggestionsAfterEmbeddings } from "../../face-embedding-suggestions-sync";

export interface FaceDetectionParams {
  folderPath: string;
  recursive?: boolean;
  mode?: "missing" | "all";
  skipPreviouslyFailed?: boolean;
}

export interface FaceDetectionOutputSummary {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  mediaItemIdsWithFaces: string[];
  totalFacesDetected: number;
  embeddedFaces: number;
  failedFaceEmbeddings: number;
  cancelledFaceEmbeddings: number;
  catchUpEmbeddedFaces: number;
  catchUpFailedFaceEmbeddings: number;
}

function validateParams(params: unknown):
  | { ok: true; value: FaceDetectionParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const folderPath = typeof candidate.folderPath === "string" ? candidate.folderPath.trim() : "";
  if (!folderPath) {
    return { ok: false, issues: "folderPath is required" };
  }
  const mode = candidate.mode === "all" ? "all" : "missing";
  return {
    ok: true,
    value: {
      folderPath,
      recursive: candidate.recursive === true,
      mode,
      skipPreviouslyFailed: candidate.skipPreviouslyFailed === true,
    },
  };
}

export const faceDetectionDefinition: PipelineDefinition<
  FaceDetectionParams,
  FaceDetectionOutputSummary
> = {
  id: "face-detection",
  displayName: "Detect faces",
  concurrencyGroup: "gpu",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    const folders = params.recursive
      ? await collectFoldersRecursivelyWithProgress(params.folderPath)
      : [params.folderPath];
    const pendingCandidates: PipelineImageItem[] = [];
    const globallyFailedPaths = new Set<string>();
    let skippedExisting = 0;

    for (const folder of folders) {
      const images = await listFolderImages(folder);
      const imagePaths = images.map((image) => image.path);
      if ((params.mode ?? "missing") === "missing") {
        const persistedDetected = getAlreadyFaceDetectedPhotoPaths(folder, imagePaths);
        skippedExisting += persistedDetected.size;
        const previouslyFailed = getFaceDetectionFailedPaths(imagePaths);
        for (const failedPath of previouslyFailed) {
          globallyFailedPaths.add(failedPath);
        }
        for (const image of images) {
          if (persistedDetected.has(image.path)) continue;
          pendingCandidates.push({ path: image.path, name: image.name, folderPath: folder });
        }
      } else {
        const previouslyFailed = getFaceDetectionFailedPaths(imagePaths);
        for (const failedPath of previouslyFailed) {
          globallyFailedPaths.add(failedPath);
        }
        for (const image of images) {
          pendingCandidates.push({ path: image.path, name: image.name, folderPath: folder });
        }
      }
    }

    const selectedImages = orderPendingPipelineItems(
      pendingCandidates,
      globallyFailedPaths,
      params.skipPreviouslyFailed === true,
    );
    await ensureCatalogForImagesWithProgress(selectedImages.map((item) => item.path));

    const faceSettings = (await readSettings(app.getPath("userData"))).faceDetection;
    const appSettings = await readSettings(app.getPath("userData"));
    if (selectedImages.length > 0) {
      const serviceReady = await ensureFaceDetectionServiceRunning();
      if (!serviceReady) {
        const message = "Face detection service is unavailable. Ensure ONNX models are downloaded.";
        console.error(`[face-detection] ${message}`);
        throw new Error(message);
      }
      await ensureFaceEmbeddingModelLoaded();
    }

    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    let totalFacesDetected = 0;
    let embeddedFaces = 0;
    let failedFaceEmbeddings = 0;
    let cancelledFaceEmbeddings = 0;
    let catchUpEmbeddedFaces = 0;
    let catchUpFailedFaceEmbeddings = 0;
    const mediaItemIdsWithFaces: string[] = [];

    ctx.report({
      type: "started",
      total: selectedImages.length,
      message: `Face detection over ${selectedImages.length} images`,
      details: { skipped: skippedExisting },
    });
    ctx.report({
      type: "phase-changed",
      phase: "detecting",
      processed: 0,
      total: selectedImages.length,
      details: { skipped: skippedExisting },
    });

    for (let i = 0; i < selectedImages.length; i++) {
      if (ctx.signal.aborted) {
        cancelled = selectedImages.length - i;
        break;
      }
      const image = selectedImages[i]!;
      try {
        await ensureMetadataForImage(image.path);
        await runWrongImageRotationPrecheck({
          imagePath: image.path,
          settings: appSettings,
          signal: ctx.signal,
        });
        const orientationState = getOrientationDetectionStateByPath(image.path);
        const detection = await detectFacesUsingOrientationState({
          imagePath: image.path,
          signal: ctx.signal,
          settings: faceSettings,
          orientationAngleClockwise: orientationState?.correctionAngleClockwise,
          enableRotationFallback: false,
        });
        const result: FaceDetectionOutput = detection.faces;
        totalFacesDetected += result.faceCount;
        const mediaId = upsertFaceDetectionResult(
          image.path,
          result,
          undefined,
          faceSettings,
          orientationState
            ? {
                correctionAngleClockwise: orientationState.correctionAngleClockwise,
                confidence: orientationState.confidence ?? 0,
                model: faceSettings.imageOrientationDetection.model,
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
              sourcePath: image.path,
              completedAt: new Date().toISOString(),
            },
          });
          if (result.faceCount > 0) {
            mediaItemIdsWithFaces.push(mediaId);
            const embeddingSummary = await embedFacesForMediaItem({
              mediaItemId: mediaId,
              imagePath: image.path,
              signal: ctx.signal,
              preferredRotationClockwise: orientationState?.correctionAngleClockwise,
              embeddingOverride: detection.embeddingOverride,
              requireLoadedModel: true,
            });
            embeddedFaces += embeddingSummary.embedded;
            failedFaceEmbeddings += embeddingSummary.failed;
            cancelledFaceEmbeddings += embeddingSummary.cancelled;
          }
        }
        completed += 1;
        ctx.report({
          type: "item-updated",
          processed: i + 1,
          total: selectedImages.length,
          message: `Detected ${result.faceCount} face(s): ${image.name}`,
          details: {
            path: image.path,
            faceCount: result.faceCount,
            totalFacesDetected,
            skipped: skippedExisting,
            mediaId: mediaId ?? null,
          },
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Unknown face detection error";
        markFaceDetectionFailed(image.path, message);
        ctx.report({
          type: "item-updated",
          processed: i + 1,
          total: selectedImages.length,
          message: `Failed: ${image.name}`,
          details: { path: image.path, error: message, totalFacesDetected, skipped: skippedExisting },
        });
      }
    }

    if (!ctx.signal.aborted) {
      const catchUpFaces = getFacesNeedingEmbeddings(DEFAULT_LIBRARY_ID);
      if (catchUpFaces.length > 0) {
        console.log(
          `[face-detection][embedding-catchup] processing ${catchUpFaces.length} face(s) missing embeddings after successful pipeline run`,
        );
        await ensureFaceEmbeddingModelLoaded();
        const catchUpResult = await embedFaceEmbeddingJobsByImage(catchUpFaces, ctx.signal);
        catchUpEmbeddedFaces = catchUpResult.embedded;
        catchUpFailedFaceEmbeddings = catchUpResult.failed;
        cancelledFaceEmbeddings += catchUpResult.cancelled;
      }
    }

    const totalEmbedded = embeddedFaces + catchUpEmbeddedFaces;
    if (!ctx.signal.aborted && totalEmbedded > 0) {
      try {
        const suggestionCount = await refreshPersonSuggestionsAfterEmbeddings();
        console.log(
          `[face-detection] refreshed person suggestions after embedding (${totalEmbedded} face(s), ${suggestionCount} suggestion row(s))`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[face-detection] person suggestion refresh failed: ${message}`);
      }
    }

    return {
      total: selectedImages.length,
      completed,
      failed,
      cancelled,
      mediaItemIdsWithFaces,
      totalFacesDetected,
      embeddedFaces,
      failedFaceEmbeddings,
      cancelledFaceEmbeddings,
      catchUpEmbeddedFaces,
      catchUpFailedFaceEmbeddings,
    };
  },
};

