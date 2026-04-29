import { getDesktopDatabase } from "../../db/client";
import { embedTextForDocument } from "../../nomic-vision-embedder";
import { MULTIMODAL_EMBED_MODEL } from "../../semantic-embeddings";
import { vectorStore } from "../../ipc/state";
import { getAiDescription, getAiTitle } from "@emk/media-metadata-core";
import type { PipelineDefinition } from "../pipeline-registry";
import { DEFAULT_LIBRARY_ID } from "../../db/folder-analysis-status";

export interface DescEmbeddingBackfillParams {
  folderPath: string;
  recursive?: boolean;
}

export interface DescEmbeddingBackfillOutput {
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  cancelled: number;
}

function validateParams(params: unknown):
  | { ok: true; value: DescEmbeddingBackfillParams }
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
      recursive: candidate.recursive !== false,
    },
  };
}

export const descEmbeddingBackfillDefinition: PipelineDefinition<
  DescEmbeddingBackfillParams,
  DescEmbeddingBackfillOutput
> = {
  id: "desc-embedding-backfill",
  displayName: "Backfill description embeddings",
  concurrencyGroup: "gpu",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    const db = getDesktopDatabase();
    const sep = params.folderPath.includes("/") ? "/" : "\\";
    const folderPrefix = params.folderPath.endsWith(sep) ? params.folderPath : params.folderPath + sep;
    const escapedPrefix = folderPrefix.replace(/[%_~]/g, "~$&") + "%";
    const folderFilter = params.recursive === false
      ? `AND mi.source_path LIKE ? ESCAPE '~' AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`
      : `AND mi.source_path LIKE ? ESCAPE '~'`;
    const folderParams = params.recursive === false ? [escapedPrefix, folderPrefix, sep] : [escapedPrefix];

    const rows = db
      .prepare(
        `SELECT mi.id, mi.ai_metadata
         FROM media_items mi
         WHERE mi.library_id = ?
           AND mi.ai_metadata IS NOT NULL
           AND mi.photo_analysis_processed_at IS NOT NULL
           AND mi.deleted_at IS NULL
           ${folderFilter}
           AND NOT EXISTS (
             SELECT 1 FROM media_embeddings me
             WHERE me.media_item_id = mi.id
               AND me.library_id = ?
               AND me.embedding_type = 'text'
               AND me.model_version = ?
           )`,
      )
      .all(DEFAULT_LIBRARY_ID, ...folderParams, DEFAULT_LIBRARY_ID, MULTIMODAL_EMBED_MODEL) as Array<{
      id: string;
      ai_metadata: string;
    }>;

    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    let cancelled = 0;
    ctx.report({
      type: "started",
      total: rows.length,
      message: `Backfilling description embeddings for ${rows.length} items`,
    });

    for (let i = 0; i < rows.length; i++) {
      if (ctx.signal.aborted) {
        cancelled = rows.length - i;
        break;
      }
      const row = rows[i]!;
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
        total: rows.length,
        message: `Backfill progress ${indexed + skipped + failed}/${rows.length}`,
        details: { indexed, skipped, failed },
      });
    }

    return { total: rows.length, indexed, skipped, failed, cancelled };
  },
};

