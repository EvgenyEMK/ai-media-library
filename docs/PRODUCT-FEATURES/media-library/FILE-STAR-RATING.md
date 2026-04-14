# File star rating (desktop catalog & UX)

## Storage

- **Column:** `media_items.star_rating` (`INTEGER`, nullable). Indexed with `idx_media_items_star_rating` on `(library_id, star_rating)` for filters and SQL lookups.
- **Embedded JSON:** The same value is mirrored under `ai_metadata.embedded.star_rating` when present (metadata scan / upload flows).

## Value meaning (industry alignment)

| Stored value | Meaning |
|----------------|--------|
| **`-1`** | **Rejected / pick** — Adobe/Lightroom-style `xmp:Rating = -1` (“below minimum useful rating”). Not a star count. |
| **`0`** | **Unrated / zero stars** — No positive star selection, or an explicit zero in XMP/EXIF. |
| **`1`–`5`** | **Star count** — Standard XMP `xmp:Rating` or EXIF when in short **0–5** form. |

Some tools write EXIF **Rating** as **0–99** or **RatingPercent** as **0–100**. The desktop importer normalizes those into **`0`–`5`** (rejection **`-1`** remains an XMP-led convention; percent alone does not imply rejected).

### Windows Explorer / RatingPercent

**Windows shell** star UI is driven largely by **`RatingPercent`** (and related IFD0 tags). Canonical non-zero values are **1, 25, 50, 75, 99** for stars **1–5**; **0** is unrated.

- **Writes** (when embedded update is enabled) set **`RatingPercent`** to that scale and IFD0 **`Rating`** to the literal **0–5** short count **ExifTool** reports after write.
- **Reads** map **0–100** into **0–5** using **range buckets** (so **1 / 25 / 50 / 75 / 99** and older **20, 40, 60, 80, 100** style values both ingest sensibly). IFD0 **`Rating`** values **> 5** (e.g. **25**) use the same bucket logic, not a simple **`n / 20`** fold.

See **`lib/storage/mwg-photo-metadata.ts`** (`starsToWindowsRatingPercent`, `windowsRatingPercentOrIfd0ToStars`, `mergeStarRating`).

## User-facing surfaces (desktop)

Shared control: **`MediaItemStarRating`** in **`@emk/media-viewer`** (inline SVG, no Lucide).

| Surface | Behavior |
|--------|----------|
| **Grid card** | Compact **★ + count** for **1–5**; hover / **focus-within** expands to five stars plus **clear (×)** only when a rating is already set (**1–5** or rejected **-1** if shown); clicks do not open the viewer. |
| **List row** | Same control on the first line above the title; row hover or focus expands the editor (same clear rule). |
| **Photo viewer → Info tab** | **Rating** is the **first line**; always shows the **five-star editor** (no hover to expand). **Clear** appears only when a rating is already set (**1–5** or rejected **-1** when enabled). |
| **Info tab sections** | File / capture / AI / invoice blocks are **`<details>`** sections, **collapsed by default**, with a **chevron** before each title. |

### Quick filters (desktop main toolbar)

The **Rating** quick-filter row uses **only** the same catalog value as the grid/viewer star control (`media_items.star_rating` passed as `fileStarRating` into `matchesThumbnailQuickFilters`). It does **not** use AI fields such as `photo_star_rating_1_5` (model output) or **AI Rating** (which uses `photo_estetic_quality`). See `lib/media-filters/thumbnail-quick-filters.ts` (`deriveUserRatingStars`).

**Touch / coarse pointer:** Prefer **`@media (hover: hover)`** where implemented so controls stay usable on devices without hover.

## Extraction order (MWG-style)

1. XMP: `xmp:Rating`, then `Rating`, then vendor aliases when exposed by ExifReader (`MicrosoftPhoto:Rating`, etc.).
2. EXIF IFD0 / image: `Rating`, then `RatingPercent`.

## Optional writes to disk

Controlled by **Settings → File metadata management → Update file metadata on change of Rating, Title, Description** (`writeEmbeddedMetadataOnUserEdit`). When **off**, only the catalog updates. When **on**, rating changes also invoke **ExifTool** after the DB commit (asynchronous). Product rule: **catalog success is not reverted** if the file write fails.

Business rules and IPC ordering: [DESKTOP-MEDIA-STAR-RATING.md](./DESKTOP-MEDIA-STAR-RATING.md).

## Keyword search (FTS5)

The `media_items_fts.rating_tokens` column holds stable tokens so queries can target ratings without noisy natural-language matches:

- `file_rating_rejected`, `file_rating_unrated`, `file_rating_1` … `file_rating_5`

These are populated from `media_items.star_rating` when FTS rows are upserted or synced.

## Dependencies

- **XMP XML** in Node/Electron uses `@xmldom/xmldom` via `lib/storage/exifreader-dom-parser.ts` passed as ExifReader’s `domParser` option (browser builds use native `DOMParser`).
- **Embedded writes** use **`exiftool-vendored`** from the Electron main process.

## Planning archive

- [2026-04 — Media star rating UX (plan snapshot)](../../IMPLEMENTATION-LOG/features/2026-04_media_star_rating_ux_0eef34a5.plan.md)
