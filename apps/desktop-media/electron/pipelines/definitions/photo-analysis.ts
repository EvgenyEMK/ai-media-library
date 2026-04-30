import { app } from "electron";
import type { PipelineDefinition } from "../pipeline-registry";
import { listFolderImages } from "../../fs-media";
import {
  collectFoldersRecursivelyWithProgress,
  ensureCatalogForImagesWithProgress,
  ensureMetadataForImage,
} from "../../ipc/folder-utils";
import { getDefaultVisionModel, warmupOllamaVisionModel } from "../../photo-analysis";
import { analyzePhotoWithOptionalTwoPass } from "../../photo-analysis-pipeline";
import { readSettings } from "../../storage";
import {
  getAlreadyAnalyzedPhotoPaths,
  getPhotoAnalysisFailedPaths,
  markPhotoAnalysisFailed,
  upsertPhotoAnalysisResult,
  upsertRotationPipelineFaces,
} from "../../db/media-analysis";
import { appendSyncOperation } from "../../db/sync-log";
import { orderPendingPipelineItems, type PipelineImageItem } from "../../ipc/pipeline-item-order";
import { runWrongImageRotationPrecheck } from "../../orientation-preprocess";

export interface PhotoAnalysisParams {
  folderPath: string;
  recursive?: boolean;
  mode?: "missing" | "all";
  skipPreviouslyFailed?: boolean;
  model?: string;
  think?: boolean;
  timeoutMsPerImage?: number;
  extractInvoiceData?: boolean;
  downscaleBeforeLlm?: boolean;
  downscaleLongestSidePx?: number;
}

export interface PhotoAnalysisOutputSummary {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  mediaItemIds: string[];
}

interface PhotoAnalysisProgressDetails {
  model: string;
  skipped: number;
  path?: string;
  mediaId?: string | null;
  error?: string;
}

function validateParams(params: unknown):
  | { ok: true; value: PhotoAnalysisParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const folderPath = typeof candidate.folderPath === "string" ? candidate.folderPath.trim() : "";
  if (!folderPath) {
    return { ok: false, issues: "folderPath is required" };
  }
  return {
    ok: true,
    value: {
      folderPath,
      recursive: candidate.recursive === true,
      mode: candidate.mode === "all" ? "all" : "missing",
      skipPreviouslyFailed: candidate.skipPreviouslyFailed === true,
      model: typeof candidate.model === "string" ? candidate.model : undefined,
      think: typeof candidate.think === "boolean" ? candidate.think : undefined,
      timeoutMsPerImage:
        typeof candidate.timeoutMsPerImage === "number" && candidate.timeoutMsPerImage > 0
          ? Math.round(candidate.timeoutMsPerImage)
          : undefined,
      extractInvoiceData:
        typeof candidate.extractInvoiceData === "boolean" ? candidate.extractInvoiceData : undefined,
      downscaleBeforeLlm:
        typeof candidate.downscaleBeforeLlm === "boolean" ? candidate.downscaleBeforeLlm : undefined,
      downscaleLongestSidePx:
        typeof candidate.downscaleLongestSidePx === "number" && candidate.downscaleLongestSidePx > 0
          ? Math.round(candidate.downscaleLongestSidePx)
          : undefined,
    },
  };
}

export const photoAnalysisDefinition: PipelineDefinition<PhotoAnalysisParams, PhotoAnalysisOutputSummary> = {
  id: "photo-analysis",
  displayName: "Analyze photos with AI",
  concurrencyGroup: "ollama",
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
      const imagePaths = images.map((img) => img.path);
      const previouslyFailed = getPhotoAnalysisFailedPaths(imagePaths);
      for (const failedPath of previouslyFailed) globallyFailedPaths.add(failedPath);

      if ((params.mode ?? "missing") === "missing") {
        const persistedAnalyzed = getAlreadyAnalyzedPhotoPaths(folder, imagePaths);
        skippedExisting += persistedAnalyzed.size;
        for (const image of images) {
          if (persistedAnalyzed.has(image.path)) continue;
          pendingCandidates.push({ path: image.path, name: image.name, folderPath: folder });
        }
      } else {
        for (const image of images) {
          pendingCandidates.push({ path: image.path, name: image.name, folderPath: folder });
        }
      }
    }
    const selected = orderPendingPipelineItems(
      pendingCandidates,
      globallyFailedPaths,
      params.skipPreviouslyFailed === true,
    );

    await ensureCatalogForImagesWithProgress(selected.map((item) => item.path));

    const appSettings = await readSettings(app.getPath("userData"));
    const model = params.model?.trim() || getDefaultVisionModel();
    const extractInvoiceData =
      typeof params.extractInvoiceData === "boolean"
        ? params.extractInvoiceData
        : appSettings.photoAnalysis.extractInvoiceData;
    const downscaleBeforeLlm =
      typeof params.downscaleBeforeLlm === "boolean"
        ? params.downscaleBeforeLlm
        : appSettings.photoAnalysis.downscaleBeforeLlm;
    const downscaleLongestSidePx = params.downscaleLongestSidePx ?? appSettings.photoAnalysis.downscaleLongestSidePx;
    const baseProgressDetails: PhotoAnalysisProgressDetails = { model, skipped: skippedExisting };

    ctx.report({
      type: "started",
      total: selected.length,
      message: `Preparing photo analysis for ${selected.length} images`,
      details: baseProgressDetails,
    });
    await warmupOllamaVisionModel({ model, timeoutMs: 90_000, signal: ctx.signal });
    ctx.report({
      type: "phase-changed",
      phase: "analyzing",
      processed: 0,
      total: selected.length,
      details: baseProgressDetails,
    });

    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    const mediaItemIds: string[] = [];
    for (let i = 0; i < selected.length; i++) {
      if (ctx.signal.aborted) {
        cancelled = selected.length - i;
        break;
      }
      const image = selected[i]!;
      try {
        await ensureMetadataForImage(image.path);
        await runWrongImageRotationPrecheck({
          imagePath: image.path,
          settings: appSettings,
          signal: ctx.signal,
        });
        const { output: result } = await analyzePhotoWithOptionalTwoPass({
          imagePath: image.path,
          model,
          think: params.think,
          timeoutMs: params.timeoutMsPerImage,
          signal: ctx.signal,
          downscaleBeforeLlm,
          downscaleLongestSidePx,
          enableTwoPassRotationConsistency: false,
          useFaceFeaturesForRotation: false,
          extractInvoiceData,
          onRotationPipelineFacesDetected: (imgPath, faces) => {
            upsertRotationPipelineFaces(imgPath, faces);
          },
        });
        const resultWithDecision = {
          ...result,
          edit_suggestions: Array.isArray(result.edit_suggestions)
            ? result.edit_suggestions.filter((suggestion) => suggestion.edit_type !== "rotate")
            : result.edit_suggestions,
        };
        const mediaId = upsertPhotoAnalysisResult(image.path, resultWithDecision);
        if (mediaId) {
          mediaItemIds.push(mediaId);
          appendSyncOperation({
            mediaId,
            operationType: "media.ai.annotate",
            payload: {
              analysisType: "photo",
              model,
              sourcePath: image.path,
              completedAt: new Date().toISOString(),
            },
          });
        }
        completed += 1;
        ctx.report({
          type: "item-updated",
          processed: i + 1,
          total: selected.length,
          message: `Analyzed: ${image.name}`,
          details: { ...baseProgressDetails, path: image.path, mediaId: mediaId ?? null },
        });
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : "Unknown photo analysis error";
        markPhotoAnalysisFailed(image.path, reason);
        ctx.report({
          type: "item-updated",
          processed: i + 1,
          total: selected.length,
          message: `Failed: ${image.name}`,
          details: { ...baseProgressDetails, path: image.path, error: reason },
        });
      }
    }

    return { total: selected.length, completed, failed, cancelled, mediaItemIds };
  },
};

