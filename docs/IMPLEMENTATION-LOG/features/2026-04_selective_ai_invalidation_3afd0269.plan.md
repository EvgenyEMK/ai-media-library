---
name: Selective AI invalidation
overview: Stop clearing expensive AI pipeline state when a metadata rescan only updates catalog fields (XMP title, star rating, dates, etc.). Invalidate only when file identity or image geometry that affects vision/face pipelines changes.
todos:
  - id: widen-select-prior-row
    content: SELECT content_hash, width, height, orientation, byte_size, file_mtime_ms for existingByPath in media-item-metadata.ts
    status: pending
  - id: guard-helper
    content: Add shouldInvalidateAiAfterCatalogUpdate(prior, next) + document hash/null rules
    status: pending
  - id: wire-conditional
    content: Call invalidateMediaItemAiAfterMetadataRefresh only when guard returns true
    status: pending
  - id: unit-tests-guard
    content: "Vitest: metadata-only vs hash/geometry change cases"
    status: pending
isProject: false
---

# Selective AI invalidation after metadata scan

## Root cause (verified)

- `[invalidateMediaItemAiAfterMetadataRefresh](apps/desktop-media/electron/db/media-ai-invalidation.ts)` runs on every successful **update** to an existing path in `[upsertMediaItemFromFilePath](apps/desktop-media/electron/db/media-item-metadata.ts)` (`if (existingByPath) { ... }`).
- It sets `photo_analysis_processed_at` and `face_detection_processed_at` to **NULL** and **DELETE**s `media_embeddings` rows for the multimodal image model.
- `[getFolderAiCoverage](apps/desktop-media/electron/db/folder-ai-coverage.ts)` counts “done” from those columns and from `media_embeddings`, so the folder summary shows **not done** for all three pipelines after a benign metadata-only refresh.

This is **not** driven by `metadata_extracted_at` being newer than pipeline timestamps; the markers are explicitly cleared.

## Recommended behavior

**Invalidate** vision / face / image-embedding pipelines only when something that can change **pixels, layout, or which file** the row represents has changed:


| Change                                                                                                         | Invalidate AI?     | Rationale                                                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `content_hash` (or checksum used as hash) changed                                                              | Yes                | Different bytes at path                                                               |
| `byte_size` or `file_mtime_ms` changed and no stable hash                                                      | Yes (conservative) | Likely file replaced                                                                  |
| `width`, `height`, or `orientation` changed                                                                    | Yes                | Geometry affects detection/viewer; embeddings assumed same pixels but rare correction |
| Only embedded XMP/IPTC, `star_rating`, `photo_taken_at` / precision, GPS text fields, `ai_metadata` merge, FTS | **No**             | Pixels unchanged                                                                      |


**Do not invalidate** when `content_hash` is unchanged **and** dimensions + orientation are unchanged (and mtime/size unchanged if you use them as a secondary signal).

## Implementation steps

1. **Extend the existing-row read** in `upsertMediaItemFromFilePath` (the `SELECT` for `existingByPath`) to include `content_hash`, `checksum_sha256`, `width`, `height`, `orientation`, `byte_size`, `file_mtime_ms` so you can compare before/after the upsert.
2. **Add a small pure helper** (e.g. `shouldInvalidateAiAfterCatalogUpdate` in `[media-ai-invalidation.ts](apps/desktop-media/electron/db/media-ai-invalidation.ts)` or a sibling `media-ai-invalidation-guards.ts` under ~80 lines) taking `{ prior, next }` snapshots and returning `boolean`:
  - Compare `content_hash` (treat `NULL` vs non-`NULL` transitions as invalidating when moving to a known hash after first hash, per product choice—document in comment).
  - Compare `width` / `height` / `orientation`.
  - Optional: if both hashes are `NULL`, require `byte_size` and `file_mtime_ms` unchanged to skip invalidation.
3. **Replace the unconditional call** with:

```ts
   if (existingByPath && shouldInvalidateAiAfterCatalogUpdate({ prior: existingByPath, next: { ...computed from metadata + observedState } })) {
     invalidateMediaItemAiAfterMetadataRefresh({ mediaItemId: itemId, libraryId });
   }
   

```

   Use the **post-parse** dimensions/orientation from the current scan and the **prior** DB row for the same fields.

1. **Unit tests** (Vitest, co-located `media-ai-invalidation*.test.ts` in `electron/db/`):
  - Hash unchanged, only title/star/date in metadata path → **no** invalidate (function returns false).
  - Hash changed → true.
  - Width/height/orientation changed with same hash → true (edge case).
2. **Optional UX follow-up** (separate small change): the “Catalog update detected” banner still counts DB `updated` rows from the scan job (`[ipc-progress-binders](apps/desktop-media/src/renderer/hooks/ipc-progress-binders.ts)`). If you want fewer false alarms, the scan could pass `totalUpdatedMeaningful` vs `totalUpdatedCosmetic`—only if easy to thread from main process. **Not required** to fix the folder summary.

## Files to touch

- `[apps/desktop-media/electron/db/media-item-metadata.ts](apps/desktop-media/electron/db/media-item-metadata.ts)` — widen SELECT; conditional invalidation.
- `[apps/desktop-media/electron/db/media-ai-invalidation.ts](apps/desktop-media/electron/db/media-ai-invalidation.ts)` — export helper or add guard module; keep `invalidateMediaItemAiAfterMetadataRefresh` unchanged for callers that truly need a full reset.
- New `[apps/desktop-media/electron/db/media-ai-invalidation-guards.test.ts](apps/desktop-media/electron/db/media-ai-invalidation-guards.test.ts)` (or adjacent) — guard tests.

## Risk note

If `content_hash` is often `NULL` in your flow, rely on `(byte_size, file_mtime_ms)` until hash is populated, or you may under-invalidate on same-size replacements—document the tradeoff in code comments.
