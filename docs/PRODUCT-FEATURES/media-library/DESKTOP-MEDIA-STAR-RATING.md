# Desktop media: star rating (business logic)

Product-facing rules for **file star ratings** in **`apps/desktop-media`**. UX surfaces are summarized in [FILE-STAR-RATING.md](./FILE-STAR-RATING.md) and [APP-SETTINGS-UX.md](./APP-SETTINGS-UX.md).

## Source of truth

1. **SQLite catalog** — `media_items.star_rating` is authoritative for in-app display, filters, and keyword search (FTS tokens).
2. **Optional file write** — When **Update file metadata on change of Rating, Title, Description** is enabled (`folderScanning.writeEmbeddedMetadataOnUserEdit`), the app also updates embedded metadata on disk (see below). A failed file write does **not** roll back the catalog row; errors are surfaced (e.g. console warning) so ratings are not lost.

## Allowed values

| Value | Meaning |
|--------|--------|
| **-1** | Rejected / pick (Adobe-style XMP). Not a star count. |
| **0** | Unrated / cleared. |
| **1–5** | Star count. |

Invalid IPC payloads are rejected; the main process clamps to integers in **0–5** for the star control (rejection **-1** is preserved where the pipeline supports it).

## Persistence pipeline (catalog)

On **`setMediaItemStarRating`**:

- Update **`media_items.star_rating`** (and related JSON / FTS as implemented in `media-item-star-rating-update` and keyword sync).
- IPC returns **success with updated metadata** immediately so the UI (grid, list, viewer Info line) can update without waiting for disk I/O.

## Embedded metadata write (optional)

When **`writeEmbeddedMetadataOnUserEdit`** is **true**:

- **ExifTool** (`exiftool-vendored`) writes **MWG-aligned** fields, including:
  - **XMP:** `Rating`, `ModifyDate`, `MetadataDate`
  - **EXIF:** IFD0 **`Rating`** (short **0–5** when stars are set) and **`RatingPercent`** on the **Windows scale** (**0**, then **1, 25, 50, 75, 99** for 1–5 stars) so **Windows Explorer** star UI stays aligned.
- The write runs **asynchronously** after the DB update so the UI stays responsive.
- After a successful write, the app runs **`refreshObservedStateForPaths`** (re-hash + update `fs_objects` for that file only, no folder tombstoning), then **`upsertMediaItemFromFilePath`** with that observed state so **`content_hash` and `file_mtime_ms` stay aligned** with disk. That prevents false AI pipeline invalidation on the next folder scan. For files **without** a computed strong hash (very large originals), **`trustedEmbeddedMetadataWrite`** skips invalidation when width/height/orientation are unchanged.

**Packaging note:** `exiftool-vendored` is loaded **externally** from the Vite main bundle so the vendored binary resolves at runtime. Packaged ASAR builds must **unpack** the exiftool vendor paths per upstream library guidance.

## Ingest (read) alignment

Embedded reads use **`lib/storage/mwg-photo-metadata.ts`**: XMP rating preferred, then EXIF **`Rating`**, then **`RatingPercent`**, with **Windows-style percent buckets** so values **1 / 25 / 50 / 75 / 99** and legacy **20·k** writes both map cleanly to **0–5**.

## Settings default

**`writeEmbeddedMetadataOnUserEdit`** defaults to **`false`** so first-time installs do not modify originals until the user opts in.

## UI (summary)

Grid, list, and photo viewer **Info** use **`MediaItemStarRating`** from **`@emk/media-viewer`**. The **clear (×)** control appears only when a rating is already set (**1–5**, or rejected **-1** when that affordance is shown). The viewer **Info** tab always shows the **five-star editor** (no hover-to-expand). Full surface-by-surface behavior: [FILE-STAR-RATING.md](./FILE-STAR-RATING.md).

## Automated verification

Desktop E2E covers catalog updates, optional on-disk **rating + mtime** after embedded writes, and **ExifTool**-visible **RatingPercent** / IFD0 **Rating** pairs for 1–5 stars (`apps/desktop-media/tests/e2e/star-rating.spec.ts`).

## Planning archive

- [2026-04 — Media star rating UX (plan snapshot)](../../IMPLEMENTATION-LOG/features/2026-04_media_star_rating_ux_0eef34a5.plan.md)
