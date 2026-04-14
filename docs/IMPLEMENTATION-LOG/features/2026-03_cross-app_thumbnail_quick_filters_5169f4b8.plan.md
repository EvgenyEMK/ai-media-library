---
name: Cross-App Thumbnail Quick Filters
overview: Add a Filter dropdown in thumbnail toolbars and implement shared AI-metadata quick-filter logic for desktop folder content and web album content, with consistent behavior and UX across both apps.
todos:
  - id: define-shared-filter-model
    content: Create shared quick-filter state and predicate helpers (people/no-people/quality/category) using metadata accessors.
    status: completed
  - id: desktop-filter-menu-and-predicate
    content: Add Filter dropdown in desktop toolbar and route grid/list rendering through filtered items.
    status: completed
  - id: web-filter-menu-and-pipeline
    content: Upgrade web album controls to dropdown quick-filters and integrate shared predicates into existing filteredMedia pipeline.
    status: completed
  - id: tests-and-validation
    content: Add unit tests for predicate behavior and validate key UX/filter scenarios in both apps.
    status: completed
isProject: false
---

# Cross-App Thumbnail Quick Filters

> **Superseded (2026-04):** Quick filters gained separate **Rating** (catalog `star_rating` / embedded XMP) and **AI Rating** (`photo_estetic_quality` only), expanded People/Documents/Categories behavior, and desktop search-grid parity. See [2026-04_desktop_quick_filters_564c7aa2.plan.md](./2026-04_desktop_quick_filters_564c7aa2.plan.md) and `lib/media-filters/thumbnail-quick-filters.ts`. The “Photo aesthetic” rules below are **not** the current product behavior.

## UX Recommendation

- Use an icon-only `Filter` button in the existing top-right control row (next to grid/list), with:
  - Active-state styling when any filter is applied
  - Small count badge for active selections
  - Clear-all action in menu footer
- Use a compact dropdown menu with grouped sections (not a side panel) for quick scanning:
  - **People**: radio group (`Any`, `1`, `2`, `3`, `4`, `5+`)
  - **No people**: single checkbox/toggle (mutually exclusive with People != `Any`)
  - **Photo aesthetic**: radio group (`All`, `3+ stars`, `4-5 stars`, `5 stars`)
  - **Categories**: multi-select checkboxes (`Nature`, `Invoices/receipts`, `Documents - ID`, `Documents - other`)
- Keep the menu open while toggling checkboxes/radios for fast multi-selection; close on outside click / Escape.
- Show a lightweight result summary in header area when active (e.g., `Filtered: 42/180`).

## Product Rules (captured)

- `No people` excludes items with missing AI/face metadata (only confidently no-people items).
- `Photo aesthetic` uses `photo_star_rating_1_5` when available; fallback to mapped stars from `photo_estetic_quality` (1-10).

## Shared Logic (single source of truth)

- Create shared quick-filter domain module, e.g. `lib/media-filters/thumbnail-quick-filters.ts`:
  - `ThumbnailQuickFilterState`
  - `hasActiveQuickFilters()`
  - `deriveAiStars(metadata)` (fallback mapping logic)
  - `matchesThumbnailQuickFilters(metadata, filterState)`
- Build predicates on top of existing metadata accessors from `[C:/EMK-Dev/emk-website/lib/media-metadata/accessors.ts](C:/EMK-Dev/emk-website/lib/media-metadata/accessors.ts)` to keep V1/V2 compatibility and consistent null handling.

## Desktop-Media Integration

- Add filter icon + dropdown to header controls in `[C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/App.tsx](C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/App.tsx)` near grid/list buttons.
- Add local quick-filter UI state in `App.tsx` (parallel to existing local menu state).
- Compute `filteredMediaItems` via `useMemo` from `mediaItems` + `mediaMetadataByItemId` and shared predicate module.
- Render grid/list from `filteredMediaItems` instead of raw `mediaItems`; keep semantic search result grid unchanged.
- Optional near-term polish: small active-filter chip/count in header; deferred server-side filtering (not needed initially because metadata is already in memory per folder stream).

## Web-Media Integration

- Extend controls in `[C:/EMK-Dev/emk-website/app/[locale]/media/components/album-content/MediaAlbumNameAndControls.tsx](C:/EMK-Dev/emk-website/app/[locale]/media/components/album-content/MediaAlbumNameAndControls.tsx)` so filter icon opens dropdown (instead of only toggling panel visibility).
- Expand filter state/logic in `[C:/EMK-Dev/emk-website/app/[locale]/media/MediaAlbumItems.tsx](C:/EMK-Dev/emk-website/app/[locale]/media/MediaAlbumItems.tsx)`:
  - Keep existing file-type and face-tag filters intact
  - Apply shared quick-filter predicates in the same `filteredMedia` pipeline
- Keep existing `MediaItemFilters` panel for advanced filters (file type + tagged people); quick filters become the primary lightweight entrypoint.

## Category Mapping

- Map user menu labels to canonical `MediaImageCategory` values in `[C:/EMK-Dev/emk-website/app/types/media-metadata.ts](C:/EMK-Dev/emk-website/app/types/media-metadata.ts)`:
  - `Nature` -> `nature`
  - `Invoices / receipts` -> `invoice_or_receipt`
  - `Documents - ID` -> `document_id_or_passport`
  - `Documents - other` -> `document_other`

## Accessibility + Consistency

- Ensure icon buttons have `title`, `aria-label`, `aria-pressed` (or equivalent active state semantics).
- Keyboard support for dropdown (Enter/Space open, Arrow keys/Tab navigation, Escape close).
- Keep text constants localized/centralized where each app already does this.

## Validation

- Add focused tests for shared predicates and star fallback mapping.
- Verify manual scenarios in both apps:
  - People count buckets
  - `No people` mutual exclusion with People
  - Mixed categories (multi-select OR semantics)
  - Quality stars from explicit stars and fallback from 1-10 score
  - Behavior when metadata is missing.

## Suggested UX Alternatives (optional refinements)

- Add **"Has AI metadata"** toggle to quickly hide unanalyzed items (particularly useful with your strict `No people` rule).
- Replace static icon with **icon + tiny dot/badge** when active to improve discoverability.
- Add **saved presets** later (e.g., `Documents`, `People portraits`) once base filters stabilize.

