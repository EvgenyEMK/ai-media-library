import { getDesktopDatabase } from "../../db/client";
import { embedTextForDocument } from "../../nomic-vision-embedder";
import { MULTIMODAL_EMBED_MODEL } from "../../semantic-embeddings";
import { vectorStore } from "../../ipc/state";
import { getAiDescription, getAiTitle } from "@emk/media-metadata-core";
import type { PipelineDefinition } from "../pipeline-registry";
import { DEFAULT_LIBRARY_ID } from "../../db/folder-analysis-status";

export interface DescriptionEmbeddingParams {
  mediaItemIds?: string[];
  folderPath?: string;
  recursive?: boolean;
}

export interface DescriptionEmbeddingOutput {
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  cancelled: number;
}

function validateParams(params: unknown):
  | { ok: true; value: DescriptionEmbeddingParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const mediaItemIds = Array.isArray(candidate.mediaItemIds)
    ? candidate.mediaItemIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : undefined;
  const folderPath =
    typeof candidate.folderPath === "string" && candidate.folderPath.trim().length > 0
      ? candidate.folderPath.trim()
      : undefined;
  if ((!mediaItemIds || mediaItemIds.length === 0) && !folderPath) {
    return { ok: false, issues: "either mediaItemIds or folderPath is required" };
  }
  return {
    ok: true,
    value: {
      mediaItemIds,
      folderPath,
      recursive: candidate.recursive !== false,
    },
  };
}

interface CandidateRow {
  id: string;
  ai_metadata: string;
}

function loadCandidates(params: DescriptionEmbeddingParams): CandidateRow[] {
  const db = getDesktopDatabase();
  if (params.mediaItemIds && params.mediaItemIds.length > 0) {
    const placeholders = params.mediaItemIds.map(() => "?").join(", ");
    return db
      .prepare(
        `SELECT id, ai_metadata
         FROM media_items
         WHERE library_id = ?
           AND id IN (${placeholders})
           AND ai_metadata IS NOT NULL
           AND photo_analysis_processed_at IS NOT NULL
           AND deleted_at IS NULL`,
      )
      .all(DEFAULT_LIBRARY_ID, ...params.mediaItemIds) as CandidateRow[];
  }

  const folderPath = params.folderPath!;
  const sep = folderPath.includes("/") ? "/" : "\\";
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : folderPath + sep;
  const escapedPrefix = folderPrefix.replace(/[%_~]/g, "~$&") + "%";
  const folderFilter = params.recursive === false
    ? `AND source_path LIKE ? ESCAPE '~' AND instr(substr(source_path, length(?) + 1), ?) = 0`
    : `AND source_path LIKE ? ESCAPE '~'`;
  const folderArgs = params.recursive === false ? [escapedPrefix, folderPrefix, sep] : [escapedPrefix];

  return db
    .prepare(
      `SELECT id, ai_metadata
       FROM media_items
       WHERE library_id = ?
         AND ai_metadata IS NOT NULL
         AND photo_analysis_processed_at IS NOT NULL
         AND deleted_at IS NULL
         ${folderFilter}`,
    )
    .all(DEFAULT_LIBRARY_ID, ...folderArgs) as CandidateRow[];
}

export const descriptionEmbeddingDefinition: PipelineDefinition<
  DescriptionEmbeddingParams,
  DescriptionEmbeddingOutput
> = {
  id: "description-embedding",
  displayName: "Embed AI photo descriptions",
  concurrencyGroup: "gpu",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    const candidates = loadCandidates(params);
    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    let cancelled = 0;

    ctx.report({
      type: "started",
      total: candidates.length,
      message: `Embedding descriptions for ${candidates.length} images`,
    });

    for (let i = 0; i < candidates.length; i++) {
      if (ctx.signal.aborted) {
        cancelled = candidates.length - i;
        break;
      }
      const row = candidates[i]!;
      try {
        const parsed = JSON.parse(row.ai_metadata) as Record<string, unknown>;
        const title = getAiTitle(parsed);
        const description = getAiDescription(parsed);
        const parts = [title, description].filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        );
        const captionText = parts.join(". ").trim();
        if (!captionText) {
          skipped += 1;
        } else {
          const vector = await embedTextForDocument(captionText, ctx.signal);
          vectorStore.upsertEmbedding({
            mediaItemId: row.id,
            embeddingType: "text",
            embeddingSource: "ai_metadata",
            modelVersion: MULTIMODAL_EMBED_MODEL,
            vector,
          });
          indexed += 1;
        }
      } catch {
        failed += 1;
      }
      ctx.report({
        type: "item-updated",
        processed: indexed + skipped + failed + cancelled,
        total: candidates.length,
        message: `Description embeddings ${indexed}/${candidates.length}`,
        details: { indexed, skipped, failed },
      });
    }
    return { total: candidates.length, indexed, skipped, failed, cancelled };
  },
};

