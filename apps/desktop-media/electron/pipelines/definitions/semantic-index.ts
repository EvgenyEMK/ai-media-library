import { app } from "electron";
import type { PipelineDefinition } from "../pipeline-registry";
import { MULTIMODAL_EMBED_MODEL } from "../../semantic-embeddings";
import { embedImageDirect, warmupVisionPipeline } from "../../nomic-vision-embedder";
import {
  collectFoldersRecursivelyWithProgress,
  collectImageEntriesForFoldersWithProgress,
  ensureCatalogForImagesWithProgress,
  ensureMetadataForImage,
} from "../../ipc/folder-utils";
import {
  ensureMediaItemForPath,
  getFailedImageEmbeddingPaths,
  getIndexedImageMediaIdsByPaths,
} from "../../db/semantic-search";
import { vectorStore } from "../../ipc/state";
import { appendSyncOperation } from "../../db/sync-log";
import { runWrongImageRotationPrecheck } from "../../orientation-preprocess";
import { readSettings } from "../../storage";

export interface SemanticIndexParams {
  folderPath: string;
  recursive?: boolean;
  mode?: "missing" | "all";
  skipPreviouslyFailed?: boolean;
}

export interface SemanticIndexOutput {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
}

function validateParams(params: unknown):
  | { ok: true; value: SemanticIndexParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const folderPath = typeof candidate.folderPath === "string" ? candidate.folderPath.trim() : "";
  if (!folderPath) return { ok: false, issues: "folderPath is required" };
  return {
    ok: true,
    value: {
      folderPath,
      recursive: candidate.recursive === true,
      mode: candidate.mode === "all" ? "all" : "missing",
      skipPreviouslyFailed: candidate.skipPreviouslyFailed === true,
    },
  };
}

export const semanticIndexDefinition: PipelineDefinition<SemanticIndexParams, SemanticIndexOutput> = {
  id: "semantic-index",
  displayName: "Build semantic search index",
  concurrencyGroup: "gpu",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    const folders = params.recursive
      ? await collectFoldersRecursivelyWithProgress(params.folderPath)
      : [params.folderPath];
    const allImages = await collectImageEntriesForFoldersWithProgress(folders);
    await ensureCatalogForImagesWithProgress(allImages.map((img) => img.path));

    const mode = params.mode === "all" ? "all" : "missing";
    const existing = getIndexedImageMediaIdsByPaths(allImages.map((img) => img.path));
    const previouslyFailed = getFailedImageEmbeddingPaths(allImages.map((img) => img.path));
    const selectedBase = mode === "missing" ? allImages.filter((img) => !existing.has(img.path)) : allImages;
    const selectedFresh = selectedBase.filter((img) => !previouslyFailed.has(img.path));
    const selectedFailed = selectedBase.filter((img) => previouslyFailed.has(img.path));
    const selected = params.skipPreviouslyFailed === true ? selectedFresh : [...selectedFresh, ...selectedFailed];

    const appSettings = await readSettings(app.getPath("userData"));
    ctx.report({
      type: "started",
      total: selected.length,
      message: `Semantic indexing ${selected.length} images`,
    });
    await warmupVisionPipeline();
    ctx.report({
      type: "phase-changed",
      phase: "embedding",
      processed: 0,
      total: selected.length,
    });

    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    for (let i = 0; i < selected.length; i++) {
      if (ctx.signal.aborted) {
        cancelled = selected.length - i;
        break;
      }
      const img = selected[i]!;
      try {
        await ensureMetadataForImage(img.path);
        await runWrongImageRotationPrecheck({
          imagePath: img.path,
          settings: appSettings,
          signal: ctx.signal,
        });
        const mediaItemId = ensureMediaItemForPath(img.path);
        if (!mediaItemId) {
          failed += 1;
          continue;
        }
        vectorStore.markEmbeddingIndexing({
          mediaItemId,
          embeddingType: "image",
          modelVersion: MULTIMODAL_EMBED_MODEL,
        });
        const vector = await embedImageDirect(img.path, ctx.signal);
        vectorStore.upsertEmbedding({
          mediaItemId,
          embeddingType: "image",
          embeddingSource: "direct_vision",
          modelVersion: MULTIMODAL_EMBED_MODEL,
          vector,
        });
        appendSyncOperation({
          mediaId: mediaItemId,
          operationType: "media.ai.annotate",
          payload: {
            analysisType: "semantic_embedding",
            embeddingModel: MULTIMODAL_EMBED_MODEL,
            sourcePath: img.path,
            completedAt: new Date().toISOString(),
          },
        });
        completed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Embedding failed";
        const mediaItemId = ensureMediaItemForPath(img.path);
        if (mediaItemId) {
          vectorStore.markEmbeddingFailed({
            mediaItemId,
            embeddingType: "image",
            modelVersion: MULTIMODAL_EMBED_MODEL,
            error: message,
          });
        }
      }
      ctx.report({
        type: "item-updated",
        processed: i + 1,
        total: selected.length,
        message: `Indexed ${i + 1}/${selected.length}`,
        details: { completed, failed, cancelled },
      });
    }
    return { total: selected.length, completed, failed, cancelled };
  },
};

