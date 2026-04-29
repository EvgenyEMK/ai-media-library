import { getDesktopDatabase } from "../../db/client";
import { runPathExtractionForMediaItem } from "../../db/media-item-path-extraction";
import type { PipelineDefinition } from "../pipeline-registry";

/**
 * Pipeline params for `path-rule-extraction`. Either:
 *   - `mediaItemIds` (used when chained behind `metadata-scan`), or
 *   - omitted to operate library-wide on items that have not yet been
 *     processed by path extraction (`path_extraction_at IS NULL`).
 *
 * Path extraction is rule-based (regex-driven date/title parsing) and very
 * cheap per item — concurrency group is "cpu".
 */
export interface PathRuleExtractionParams {
  mediaItemIds?: string[];
}

export interface PathRuleExtractionOutput {
  /** Number of media items that path extraction was attempted on. */
  considered: number;
  /** Number of items where path extraction succeeded without an exception. */
  processed: number;
  /** Number of items where the extractor threw and the item was skipped. */
  failed: number;
}

interface CandidateRow {
  id: string;
  source_path: string;
  photo_taken_at: string | null;
  photo_taken_precision: "year" | "month" | "day" | "instant" | null;
  file_created_at: string | null;
}

const QUERY_CHUNK = 900;

/**
 * Fetch the inputs `runPathExtractionForMediaItem` needs, by id. Defined
 * here (rather than in `db/`) because this is the only caller; if other
 * callers materialise we can promote it into `media-item-metadata.ts`.
 */
function loadCandidatesByIds(ids: string[]): CandidateRow[] {
  if (ids.length === 0) return [];
  const db = getDesktopDatabase();
  const out: CandidateRow[] = [];
  for (let i = 0; i < ids.length; i += QUERY_CHUNK) {
    const chunk = ids.slice(i, i + QUERY_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    out.push(
      ...(db
        .prepare(
          `SELECT id, source_path, photo_taken_at, photo_taken_precision, file_created_at
           FROM media_items
           WHERE id IN (${placeholders})`,
        )
        .all(...chunk) as CandidateRow[]),
    );
  }
  return out;
}

function loadAllCandidatesNeedingExtraction(): CandidateRow[] {
  const db = getDesktopDatabase();
  return db
    .prepare(
      `SELECT id, source_path, photo_taken_at, photo_taken_precision, file_created_at
       FROM media_items
       WHERE deleted_at IS NULL
         AND path_extraction_at IS NULL`,
    )
    .all() as CandidateRow[];
}

/**
 * Pipeline definition that runs the rule-based path/filename extractor for a
 * list of media items. Replaces the inline call inside `runMetadataScanJob`
 * (which loops over freshly upserted rows and calls the same per-item
 * function).
 */
export const pathRuleExtractionDefinition: PipelineDefinition<
  PathRuleExtractionParams,
  PathRuleExtractionOutput
> = {
  id: "path-rule-extraction",
  displayName: "Extract dates from filenames",
  concurrencyGroup: "cpu",
  run: async (ctx, params) => {
    ctx.report({ type: "started" });

    const candidates =
      params.mediaItemIds && params.mediaItemIds.length > 0
        ? loadCandidatesByIds(params.mediaItemIds)
        : loadAllCandidatesNeedingExtraction();

    ctx.report({
      type: "phase-changed",
      phase: "extracting",
      processed: 0,
      total: candidates.length,
    });

    if (candidates.length === 0) {
      return { considered: 0, processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    for (let i = 0; i < candidates.length; i++) {
      if (ctx.signal.aborted) break;
      const row = candidates[i]!;
      try {
        runPathExtractionForMediaItem({
          filePath: row.source_path,
          mediaItemId: row.id,
          photoTakenAt: row.photo_taken_at,
          photoTakenPrecision: row.photo_taken_precision,
          fileCreatedAt: row.file_created_at,
        });
        processed += 1;
      } catch {
        failed += 1;
      }
      // Throttle progress emissions to keep IPC quiet.
      if ((i + 1) % 50 === 0 || i + 1 === candidates.length) {
        ctx.report({
          type: "item-updated",
          processed: i + 1,
          total: candidates.length,
        });
        // Yield to the event loop so other I/O can interleave.
        await Promise.resolve();
      }
    }

    return { considered: candidates.length, processed, failed };
  },
};
