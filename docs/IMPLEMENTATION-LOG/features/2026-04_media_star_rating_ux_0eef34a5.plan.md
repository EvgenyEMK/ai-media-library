---
name: Media star rating UX
overview: Add interactive star ratings on desktop grid and list views using reusable building blocks in `@emk/media-viewer`, persist to SQLite + embedded JSON + FTS, optionally write MWG-aligned XMP/EXIF via ExifTool when a new settings flag is enabled, and extend settings UI (section rename + checkbox).
todos:
  - id: shared-star-ui
    content: Add MediaItemStarRating + extend MediaItemGridCard, MediaThumbnailGrid, MediaItemListRow, MediaThumbnailGridItem types; export from media-viewer; Vitest/RTL tests
    status: pending
  - id: db-ipc-exiftool
    content: "Implement setMediaItemStarRating IPC: SQL + ai_metadata JSON patch + FTS; ExifTool helper (XMP + EXIF Windows) gated by settings; optional upsert refresh after file write"
    status: pending
  - id: desktop-plumbing
    content: Wire DesktopMediaWorkspace + list row + filtered/semantic item maps; action registry; merge mediaMetadataByItemId on success
    status: pending
  - id: settings-ui
    content: Extend FolderScanningSettings + storage sanitize; rename settings section; SettingsCheckboxField + persistence
    status: pending
isProject: false
---

# Media item star rating (desktop-first, reusable for web)

## Context (what already exists)

- **DB:** `[media_items.star_rating](apps/desktop-media/electron/db/client.ts)` (-1 rejected, 0 unrated, 1–5 stars), mirrored in `ai_metadata.embedded.star_rating`; FTS tokens via `[syncFtsForMediaItem](apps/desktop-media/electron/db/keyword-search.ts)`.
- **Types / renderer data:** `[DesktopMediaItemMetadata.starRating](apps/desktop-media/src/shared/ipc.ts)`, already used for quick filters in `[use-filtered-media-items.ts](apps/desktop-media/src/renderer/hooks/use-filtered-media-items.ts)`.
- **Grid / list:** `[MediaThumbnailGrid](packages/media-viewer/src/grid/media-thumbnail-grid.tsx)` + `[MediaItemGridCard](packages/media-viewer/src/grid/media-item-grid-card.tsx)`; list via `[MediaItemListRow](packages/media-viewer/src/grid/media-item-list-row.tsx)`, composed in `[DesktopMediaWorkspace.tsx](apps/desktop-media/src/renderer/components/DesktopMediaWorkspace.tsx)` and `[DesktopMediaItemListRow.tsx](apps/desktop-media/src/renderer/components/DesktopMediaItemListRow.tsx)`.
- **MWG read path:** `[lib/storage/mwg-photo-metadata.ts](lib/storage/mwg-photo-metadata.ts)` documents XMP + Windows EXIF `Rating` / `RatingPercent` merge.
- **No ExifTool** in the repo today; `[apps/desktop-media/package.json](apps/desktop-media/package.json)` has `exifreader` only (read). Writes will be new.

## Design decisions and UX challenges


| Topic                          | Recommendation                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Star glyph**                 | Use **inline SVG** stars (project rule: no emoji; your “★ 4” spec maps to filled SVG + digit).                                                                                                                                                                                                                                              |
| **“Rated” badge**              | Show compact badge only for **1–5**. Treat `**0`, `null`, and `-1`** as “no badge” unless you later want a distinct “rejected” affordance (`[FILE-STAR-RATING.md](docs/PRODUCT-FEATURES/media-library/FILE-STAR-RATING.md)`); optional follow-up: tiny reject icon for `-1`.                                                                              |
| **Unset control**              | Maps to stored `**0`** (and XMP/EXIF cleared to unrated per MWG).                                                                                                                                                                                                                                                                           |
| **Hover-only grid**            | Match your spec; add `**focus-within`** on the card so keyboard users can reach stars without mouse. For **touch**, hover is fragile — recommend `**@media (hover: hover) and (pointer: fine)`** to show interactive controls, and a **tap on the badge** (when coarse pointer) to open the same control — call this out in implementation. |
| **Click vs open viewer**       | All rating controls `**stopPropagation`** so they do not trigger `onItemClick` / row open.                                                                                                                                                                                                                                                  |
| **Tailwind vs shared package** | `[packages/media-viewer/AGENTS.md](packages/media-viewer/AGENTS.md)` forbids Tailwind inside the package. Reusable UI should use **inline styles + `hsl(var(--…))`** (same pattern as `MediaItemListRow`). Desktop wrappers stay Tailwind where needed.                                                                                     |
| **Persist order**              | **Update DB first** (source of truth in app); then optional ExifTool. If ExifTool fails, return `**{ success: true, fileWriteWarning }`** or `**success: false`** only when DB fails — product choice: prefer **DB success + surfaced file error** so ratings are not lost.                                                                 |


## Windows / XMP vs Explorer

- **XMP `xmp:Rating`** is the **cross-app/Lightroom/Adobe** lingua franca; write this for MWG-minded interoperability.
- **Windows Explorer / “Photos”** often relies on **EXIF IFD0 `Rating` and `RatingPercent`** (0–100 buckets). Your ingest path already normalizes `RatingPercent` (`[normalizePercentToStars](lib/storage/mwg-photo-metadata.ts)`). For writes, add a small **inverse** helper (e.g. stars 1–5 → percent buckets aligned with `ceil(n/20)` logic — place next to existing merge code in `[mwg-photo-metadata.ts](lib/storage/mwg-photo-metadata.ts)`) and pass **both** XMP and EXIF tags through ExifTool so Explorer-friendly viewers see updates.
- **Reality check:** After writing, **shell thumbnails / Explorer stars** may lag due to **OS caching**; ExifTool’s in-place write still changes the file — a follow-up rescan (`upsertMediaItemFromFilePath`) refreshes catalog hash/mtime. AI invalidation should **not** trigger when geometry is unchanged ([see guards](apps/desktop-media/electron/db/media-ai-invalidation-guards.ts)).

**Suggested ExifTool arguments (main-process helper):** `exiftool` with `-overwrite_original_in_place` (or project-standard), set at least:

- `XMP:Rating`, `XMP:ModifyDate`, `XMP:MetadataDate` (ISO 8601 with offset / ExifTool `now` semantics),
- `EXIF:Rating` and `EXIF:RatingPercent` for Windows-facing consumers,
- When clearing: set rating fields to **0** / remove where appropriate (validate per format — ExifTool `-XMP:Rating=0` vs `=` delete).

**Bundling:** Introduce either `**exiftool-vendored`** (heavier, reliable on Windows) or `**exiftool` on `PATH`** with a clear settings / docs note. Recommend **vendored** for consistent desktop installs; fallback message if binary missing.

## Settings

- In `[apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts)`: extend `**FolderScanningSettings`** with e.g. `writeEmbeddedMetadataOnUserEdit: boolean`, default `**false`**, and `**DEFAULT_FOLDER_SCANNING_SETTINGS`** update.
- In `[apps/desktop-media/electron/storage.ts](apps/desktop-media/electron/storage.ts)`: sanitize the new boolean in `**sanitizeFolderScanningSettings**`.
- UI: `[DesktopSettingsSection.tsx](apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx)` — change section title string from **“Folder scanning”** to **“File metadata management”**; add **checkbox** with label **“Update file metadata on change of Rating, Title, Description”** (behaviour: rating write now; title/description when those editors exist). Reuse pattern from face settings: optional new `**SettingsCheckboxField`** in `[packages/media-viewer/src/settings-controls.tsx](packages/media-viewer/src/settings-controls.tsx)` (Tailwind allowed here like other settings controls) to avoid duplicating markup.
- Renderer persistence: follow existing `**updateFolderScanningSetting`** / `saveSettings` flow (`[DesktopAppMain.tsx](apps/desktop-media/src/renderer/components/DesktopAppMain.tsx)` props already wired).

## Shared UI (`@emk/media-viewer`)

1. `**MediaThumbnailGridItem`** (`[packages/media-viewer/src/types.ts](packages/media-viewer/src/types.ts)`): add optional `**starRating: number | null`** and `**onStarRatingChange?: (next: number) => void**` (or pass through card props from parent).
2. **New presentational module** (e.g. `media-item-star-rating.tsx`): compact badge (1–5 only); expanded row with **5 clickable stars**, **clear/unset** control (SVG), **ARIA** (`radiogroup` / `button`s with `aria-pressed` or `aria-label` per star), keyboard **1–5** and **0** for clear.
3. `**MediaItemGridCard`**: top-left overlay for badge; on hover/focus-within (and coarse-pointer strategy above), swap to interactive control; `**pointer-events`** and z-index above image; ensure actions menu (top-right) unchanged.
4. `**MediaThumbnailGrid**`: forward rating props per item to each card.
5. `**MediaItemListRow**`: insert **optional first line** above `[title](packages/media-viewer/src/grid/media-item-list-row.tsx)` (same star module); row hover/focus already exists — align visibility with grid behaviour.
6. **Exports** in `[packages/media-viewer/src/index.ts](packages/media-viewer/src/index.ts)`.
7. **Tests:** Vitest + RTL for the star module (happy path: set 3, clear → 0; keyboard; `stopPropagation` on inner buttons).

## Desktop IPC and DB write path

1. **Channel + types:** In `[ipc.ts](apps/desktop-media/src/shared/ipc.ts)` add e.g. `setMediaItemStarRating` and payload `{ sourcePath: string; starRating: number }` (clamp **0–5** server-side; reject invalid).
2. **Preload + `DesktopApi`:** wire invoke in `[preload.ts](apps/desktop-media/electron/preload.ts)`.
3. **New handler module** (e.g. `[electron/ipc/media-item-mutation-handlers.ts](apps/desktop-media/electron/ipc/media-item-mutation-handlers.ts)`), registered from `[main.ts](apps/desktop-media/electron/main.ts)`:
  - Resolve `**media_items` row** by `library_id` + `source_path` (same as other DB code; default library id pattern from `[DEFAULT_LIBRARY_ID](apps/desktop-media/electron/db/folder-analysis-status.ts)`).
  - `**UPDATE media_items SET star_rating = ?`**, patch `**ai_metadata`** JSON for `embedded.star_rating`, bump `updated_at`, call `**syncFtsForMediaItem**`.
  - If `settings.folderScanning.writeEmbeddedMetadataOnUserEdit`: run ExifTool helper, then optionally `**upsertMediaItemFromFilePath**` for that path to refresh hash/mtime (reuse existing pipeline in `[media-item-metadata.ts](apps/desktop-media/electron/db/media-item-metadata.ts)`) — geometry guard prevents unnecessary AI invalidation.
4. **Renderer:** `[actions/](apps/desktop-media/src/renderer/actions/)` registry function e.g. `setMediaItemStarRating(sourcePath, value)` calling IPC; on success merge into `**mediaMetadataByItemId`** (same shape as `[use-folder-metadata-merge.ts](apps/desktop-media/src/renderer/hooks/use-folder-metadata-merge.ts)` / lookup helpers).
5. **Data plumbing:** Extend `**DesktopFilteredMediaItem`** with `starRating`; map from metadata in `[use-filtered-media-items.ts](apps/desktop-media/src/renderer/hooks/use-filtered-media-items.ts)`. For **semantic** grid/list branches in `DesktopMediaWorkspace`, pass `**starRating`** via `**lookupMediaMetadataByItemId`** (pattern already used for dates in filtered hooks).

## Web-media later

- `[MediaAlbumItemsGridView.tsx](app/[locale]/media/components/album-content/MediaAlbumItemsGridView.tsx)` can pass `**starRating`** + server action when Supabase stores ratings; no desktop-only imports inside `media-viewer`.

## Files to touch (summary)


| Area              | Files                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared UI         | `[packages/media-viewer/src/grid/](packages/media-viewer/src/grid/)`*, `[types.ts](packages/media-viewer/src/types.ts)`, `[index.ts](packages/media-viewer/src/index.ts)`, new `*.test.tsx`                                                                                                                                          |
| Desktop workspace | `[DesktopMediaWorkspace.tsx](apps/desktop-media/src/renderer/components/DesktopMediaWorkspace.tsx)`, `[DesktopMediaItemListRow.tsx](apps/desktop-media/src/renderer/components/DesktopMediaItemListRow.tsx)`, `[use-filtered-media-items.ts](apps/desktop-media/src/renderer/hooks/use-filtered-media-items.ts)`, new/updated action |
| IPC / main        | `[ipc.ts](apps/desktop-media/src/shared/ipc.ts)`, `[preload.ts](apps/desktop-media/electron/preload.ts)`, `[main.ts](apps/desktop-media/electron/main.ts)`, new handler + ExifTool helper, new/extended DB helper for JSON patch + FTS                                                                                               |
| Settings          | `[ipc.ts` defaults](apps/desktop-media/src/shared/ipc.ts), `[storage.ts](apps/desktop-media/electron/storage.ts)`, `[DesktopSettingsSection.tsx](apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx)`, `[settings-controls.tsx](packages/media-viewer/src/settings-controls.tsx)`                                 |
| MWG write helpers | `[mwg-photo-metadata.ts](lib/storage/mwg-photo-metadata.ts)` (+ tests for inverse percent mapping)                                                                                                                                                                                                                                   |


## Optional doc updates (only if you want repo UX docs in sync)

- `[docs/PRODUCT-FEATURES/media-library/APP-SETTINGS-UX.md](docs/PRODUCT-FEATURES/media-library/APP-SETTINGS-UX.md)` section rename + new checkbox (you can defer if avoiding markdown churn).

