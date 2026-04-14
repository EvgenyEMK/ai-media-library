import { mergeMetadataV2, normalizeMetadata } from "@emk/media-metadata-core";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { syncFtsForMediaItem } from "./keyword-search";
import type { DesktopMediaItemMetadata } from "../../src/shared/ipc";
import { getMediaItemMetadataByPaths } from "./media-item-metadata";

function parseAiMetadataJson(raw: string | null): unknown {
  if (!raw?.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Updates `media_items.star_rating`, merges `embedded.star_rating` in `ai_metadata`, refreshes FTS.
 * Does not touch files on disk.
 */
export function updateMediaItemStarRatingInDb(params: {
  sourcePath: string;
  starRating: number;
  libraryId?: string;
}): { ok: true; metadata: DesktopMediaItemMetadata } | { ok: false; error: string } {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const starRating = params.starRating;
  if (!Number.isFinite(starRating) || starRating < 0 || starRating > 5 || !Number.isInteger(starRating)) {
    return { ok: false, error: "starRating must be an integer from 0 to 5." };
  }

  const trimmedPath = params.sourcePath.trim();
  if (!trimmedPath) {
    return { ok: false, error: "sourcePath is required." };
  }

  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT id, ai_metadata FROM media_items WHERE library_id = ? AND source_path = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .get(libraryId, trimmedPath) as { id: string; ai_metadata: string | null } | undefined;

  if (!row) {
    return { ok: false, error: "Media item not found for path." };
  }

  const priorAi = parseAiMetadataJson(row.ai_metadata);
  const merged = normalizeMetadata(
    mergeMetadataV2(priorAi, {
      embedded: {
        star_rating: starRating,
      },
    }),
  );
  const nextAi = JSON.stringify(merged);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE media_items SET star_rating = ?, ai_metadata = ?, updated_at = ? WHERE id = ? AND library_id = ?`,
  ).run(starRating, nextAi, now, row.id, libraryId);

  try {
    syncFtsForMediaItem(row.id, libraryId);
  } catch {
    // best-effort
  }

  const byPath = getMediaItemMetadataByPaths([trimmedPath], libraryId);
  const metadata = byPath[trimmedPath];
  if (!metadata) {
    return { ok: false, error: "Failed to load metadata after update." };
  }
  return { ok: true, metadata };
}
