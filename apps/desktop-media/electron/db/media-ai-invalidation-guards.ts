/**
 * Decides whether a catalog/metadata refresh should clear expensive AI pipeline state.
 * Conservative when file identity or decode geometry may have changed; skips when only
 * sidecar metadata (XMP, ratings, etc.) changed for the same bytes.
 */

export interface MediaItemCatalogPriorSnapshot {
  content_hash: string | null;
  width: number | null;
  height: number | null;
  orientation: number | null;
  byte_size: number | null;
  file_mtime_ms: number | null;
}

export interface MediaItemCatalogNextSnapshot {
  content_hash: string | null;
  width: number | null;
  height: number | null;
  orientation: number | null;
  byte_size: number | null;
  file_mtime_ms: number | null;
}

function normHash(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const t = String(value).trim();
  return t.length > 0 ? t : null;
}

/**
 * Returns true if vision / face / image-index pipelines should be invalidated.
 *
 * Rules:
 * - Different non-null content hashes → invalidate **unless** width/height/orientation are unchanged
 *   (same decoded geometry → typical XMP/embedded metadata rewrite only, e.g. star rating; full-file hash still changes).
 * - Prior hash null, next hash set → do **not** invalidate (hash often filled later for the same file).
 * - Prior hash set, next null → invalidate (unusual).
 * - Same hash (including both null): invalidate if width/height/orientation changed.
 * - Both hashes null: also invalidate if byte size or mtime changed (no hash to detect replacement).
 */
export function shouldInvalidateAiAfterCatalogUpdate(params: {
  prior: MediaItemCatalogPriorSnapshot;
  next: MediaItemCatalogNextSnapshot;
}): boolean {
  const { prior, next } = params;
  const pHash = normHash(prior.content_hash);
  const nHash = normHash(next.content_hash);

  if (pHash !== nHash) {
    if (pHash === null && nHash !== null) {
      return false;
    }
    if (pHash !== null && nHash === null) {
      return true;
    }
    if (pHash !== null && nHash !== null) {
      if (
        prior.width === next.width &&
        prior.height === next.height &&
        prior.orientation === next.orientation
      ) {
        return false;
      }
      return true;
    }
  }

  if (
    prior.width !== next.width ||
    prior.height !== next.height ||
    prior.orientation !== next.orientation
  ) {
    return true;
  }

  if (pHash === null && nHash === null) {
    if (prior.byte_size !== next.byte_size || prior.file_mtime_ms !== next.file_mtime_ms) {
      return true;
    }
  }

  return false;
}

/**
 * Applies `shouldInvalidateAiAfterCatalogUpdate`, then optionally suppresses invalidation when
 * the caller attests the refresh was from a trusted embedded-metadata write (e.g. ExifTool
 * rating/title) and decode geometry is unchanged. Used for upserts after disk writes that bump
 * mtime/bytes without changing pixels, and for large files where `strong_hash` is not computed.
 */
export function shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert(params: {
  prior: MediaItemCatalogPriorSnapshot;
  next: MediaItemCatalogNextSnapshot;
  trustedEmbeddedMetadataWrite?: boolean;
}): boolean {
  const invalidate = shouldInvalidateAiAfterCatalogUpdate({
    prior: params.prior,
    next: params.next,
  });
  if (!invalidate) {
    return false;
  }
  if (
    params.trustedEmbeddedMetadataWrite === true &&
    params.prior.width === params.next.width &&
    params.prior.height === params.next.height &&
    params.prior.orientation === params.next.orientation
  ) {
    return false;
  }
  return true;
}
