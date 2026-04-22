import { normalizeMetadata } from "@emk/media-metadata-core";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

/**
 * Clears per-file AI pipeline markers when the **decode geometry** or **meaningful** file
 * identity changed (see `shouldInvalidateAiAfterCatalogUpdate`). Skipped for edits that only
 * change embedded metadata (XMP/IPTC, star rating, etc.) — including cases where the full-file
 * `content_hash` changes but width/height/orientation stay the same (common after rating/title saves).
 *
 * **What the `media_embeddings` DELETE removes (and what it does not):**
 *
 * - **Removed:** Rows in `media_embeddings` with `embedding_type = 'image'` and
 *   `model_version = MULTIMODAL_EMBED_MODEL` — the **multimodal / CLIP-style image vector**
 *   used for **AI image search** (vision branch: embed image, compare to text query).
 *   This is **not** face recognition data.
 * - **Not removed:** Rows with `embedding_type = 'text'` (e.g. cached embeddings built from
 *   AI-generated **title/description** for the hybrid keyword+vector search path).
 * - **Not removed:** Face **detection boxes**, face **tags**, or per-face **embeddings** —
 *   those live in `media_face_instances` and related face tables, not in this DELETE.
 *
 * Call sites should use `shouldInvalidateAiAfterCatalogUpdate` so benign catalog refreshes
 * do not wipe photo/face completion flags or vision search vectors.
 */
export function invalidateMediaItemAiAfterMetadataRefresh(params: {
  mediaItemId: string;
  libraryId?: string;
}): void {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const row = db
    .prepare(`SELECT ai_metadata FROM media_items WHERE id = ? AND library_id = ? LIMIT 1`)
    .get(params.mediaItemId, libraryId) as { ai_metadata: string | null } | undefined;
  const sanitizedAiMetadata = sanitizeAiMetadataAfterContentRefresh(row?.ai_metadata, now);
  db.prepare(
    `UPDATE media_items
     SET photo_analysis_processed_at = NULL,
         photo_analysis_failed_at = NULL,
         photo_analysis_error = NULL,
         face_detection_processed_at = NULL,
         face_detection_failed_at = NULL,
         face_detection_error = NULL,
         ai_metadata = ?,
         updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(sanitizedAiMetadata, now, params.mediaItemId, libraryId);

  // Remove stale search vectors from the prior file bytes (both image and text embeddings).
  db.prepare(
    `DELETE FROM media_embeddings
     WHERE media_item_id = ?
       AND library_id = ?`,
  ).run(params.mediaItemId, libraryId);

  // Remove stale face detections/tags tied to previous file content at the same path.
  db.prepare(
    `DELETE FROM media_face_instances
     WHERE media_item_id = ?
       AND library_id = ?`,
  ).run(params.mediaItemId, libraryId);
}

function sanitizeAiMetadataAfterContentRefresh(
  aiMetadataRaw: string | null | undefined,
  metadataExtractedAt: string,
): string {
  const normalized = normalizeMetadata(parseJson(aiMetadataRaw));
  const next = normalizeMetadata({
    schema_version: "2.0",
    technical: normalized.technical ?? undefined,
    embedded: normalized.embedded ?? undefined,
    provenance: {
      ...(normalized.provenance ?? {}),
      metadata_extracted_at: metadataExtractedAt,
      sources: {
        ...(normalized.provenance?.sources ?? {}),
      },
    },
  });
  return JSON.stringify(next);
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
