# Date Metadata PRD

## Purpose

The media library stores date metadata so users can browse media chronologically, filter folders/search results, and build smart albums such as years, trips, and events. Dates may come from embedded capture metadata, file system properties, or AI/file-path extraction. The product must preserve enough provenance to explain and improve date choices later.

## Product Goals

- Show reliable date context in lists and the PhotoViewer Info tab.
- Support quick filters and search filters by year/date range.
- Support album filters by year/month.
- Support smart albums such as `Year > Trips`.
- Prefer capture dates over inferred dates when capture metadata exists.

## Date Sources

### Embedded Capture Date

Embedded capture date is the highest-confidence date for photos and videos.

- Sources: EXIF/XMP capture fields and video metadata.
- Stored catalog fields:
  - `media_items.photo_taken_at`
  - `media_items.photo_taken_precision`
- Intended meaning: when the camera/video says the media was captured.

### File System Date

File system date is a fallback when no embedded capture date exists.

- Source: file created/modified timestamp available during metadata scan.
- Stored catalog field:
  - `media_items.file_created_at`
- Intended meaning: approximate date for display, not a trusted capture date.

### File Path LLM Date Extraction

Path LLM extraction infers dates from folder names and filenames.

- Input examples:
  - `2024-06 Croatia Split/IMG_001.jpg`
  - `1999 Family Trip/photo.jpg`
- Stored metadata:
  - `ai_metadata.path_extraction.date`
- Stored catalog fields:
  - `media_items.event_date_start`
  - `media_items.event_date_end`
  - `media_items.event_date_precision`
  - `media_items.event_date_source = 'path_llm'`

Path-derived dates are event dates. They may represent a trip, folder, or album context rather than the exact capture timestamp.

### Scripted Path Date Extraction

Scripted extraction handles obvious filename/folder date patterns before LLM enrichment.

- Stored metadata:
  - `ai_metadata.path_extraction.date`
- Stored catalog fields:
  - `media_items.event_date_start`
  - `media_items.event_date_end`
  - `media_items.event_date_precision`
  - `media_items.event_date_source = 'path_script'`

### VLM Image Analysis Date

VLM image analysis may infer date-like signals from visual content, but this is generally low confidence unless a document/photo visibly contains a date.

- Current storage: VLM date is stored in `ai_metadata.image_analysis.date`.
- It should not overwrite capture date or event date without an explicit product decision.
- It may be useful for document search or future “possible date” suggestions.

## Date Semantics

The product distinguishes two concepts:

- Capture date: when the image/video was actually captured (`photo_taken_at`).
- Event date: the best catalog date for browsing/filtering event collections (`event_date_*`).

Event date resolution should prefer:

1. Embedded capture date, when present and precise enough.
2. Path-extracted date, when capture date is absent or less useful for the event context.
3. File system date as fallback.

Exact precedence should remain explicit in code and tests because browsing and filters depend on it.

## Storage Model

### Catalog Fields

- `media_items.photo_taken_at`: capture timestamp/date from embedded metadata.
- `media_items.photo_taken_precision`: `year`, `month`, `day`, or `instant`.
- `media_items.file_created_at`: file system fallback date.
- `media_items.event_date_start`: resolved event start date.
- `media_items.event_date_end`: resolved event end date.
- `media_items.event_date_precision`: precision of event date.
- `media_items.event_date_source`: `photo_taken`, `path_llm`, `path_script`, or `file_created`.

### Metadata JSON

- `ai_metadata.file_data.technical.capture`: embedded technical capture metadata.
- `ai_metadata.path_extraction.date`: path-derived date details.
- `ai_metadata.image_analysis.date`: VLM-inferred visual date, if any.

## UI Usage

### PhotoViewer Info Tab

PhotoViewer should show:

- Date taken: from `photo_taken_at` when available.
- Date precision: from `photo_taken_precision`.
- File date: from `file_created_at`.
- Future enhancement: event date display from `event_date_*` when it differs from capture date.

### Thumbnail/List Views

Grid/list date labels should prefer capture date and fall back to file date for user-friendly display. Event date can be shown in future when smart album context makes it more relevant.

## Filters and Search

### Thumbnail Quick Filters

Year/date quick filters should use resolved event date fields:

- `event_date_start`
- `event_date_end`

This lets path-derived dates make old scans and renamed files filterable even when EXIF capture dates are missing.

### AI Search and Keyword Search Filters

Search date filters should use the same event date fields as quick filters so folder results and search results behave consistently.

### Album Filters

Album list date filters currently use year/month bounds. Product intent is:

- Prefer resolved event dates for event/trip browsing.
- Fall back to capture/file dates only when `event_date_*` is absent.

This should be aligned in implementation so album filters and thumbnail/search filters use the same date semantics.

## Smart Albums

Smart albums should be based on resolved event dates unless explicitly showing “capture date” albums.

Initial product groups:

- `Year > Trips`
  - Group by `event_date_start` year/month and country/city clusters.
  - First version can approximate trips as month + countries/cities count.
- `Best of Year`
  - Use resolved event year if available.
  - Fall back to capture/file year when no event date exists.

## Acceptance Criteria

- Capture date, file date, path-derived event date, and VLM visual date remain distinguishable.
- Quick filters and search filters use the same date fields.
- Album filters and smart albums have documented, testable date precedence.
- Path-derived dates make scanned/renamed media filterable even without EXIF dates.
- VLM date does not silently overwrite trusted capture/event dates.
