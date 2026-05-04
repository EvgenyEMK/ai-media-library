# Desktop albums — business logic

## Concepts

| Kind | Meaning |
| --- | --- |
| **Manual album** | User-created album stored in SQLite (`media_albums`, `media_album_items`). Membership and **display order** are persisted. |
| **Smart album** | **No** separate album row for the dynamic collection. The UI issues **read-only queries** (places, years, then items) parameterized by root kind, grouping, filters, and optional leaf keys (country, city, area levels, year, etc.). |

Shared request/response shapes live in `@emk/shared-contracts` (`albums.ts`).

## Manual albums — data rules

- **Create:** new album with title; optional description and cover in the data model as exposed by IPC.
- **List:** supports filters (title, location, person tags, date bounds, include-unconfirmed-faces semantics) and pagination for large libraries.
- **Items:** paged list of catalog media rows joined to the album; includes star rating and dimensions for display.
- **Add / remove:** link or unlink media items by catalog id.
- **Cover:** optional `cover_media_item_id` pointing at a member (or cleared).
- **Delete album:** application rules for whether non-empty albums can be deleted follow product decisions enforced in UI + main process.
- **Reorder:** `reorderAlbumMediaItem(albumId, mediaItemId, insertBeforeIndex)` updates **positions** in `media_album_items`. Index is **global** across the album (0 = before first item; album length = append after last). Implementation uses a stable “move id before index” helper on the ordered id list.

## Smart albums — place queries

- **`SmartAlbumPlacesRequest`** includes `grouping`, `source`, and optional `filters`.
- **`source`:** `gps` uses GPS-derived location fields; `non-gps` uses “country-like” locations from non-GPS signals (e.g. AI/path), as defined in SQL.
- **`grouping`:** drives SQL `GROUP BY` / labels — e.g. `year-city`, `year-area`, `area-city`, `month-area`. Entries carry optional `leafLevel` (`area1` | `area2` | `city`) for dynamic **Country > Area > City** navigation.
- **Labels:** entries expose display `label`, `group`, optional `groupParent` (e.g. admin1 next to admin2).

## Smart albums — item queries

- **`SmartAlbumItemsRequest`** discriminated union:
  - **`place`:** country, optional city, group label, grouping, source, optional hierarchy fields (`leafLevel`, `area1`, `area2`), filters, pagination.
  - **`best-of-year`:** calendar `year`, filters, pagination, optional **`randomize`** and **`randomCandidateLimit`** (cap how many candidates enter the shuffle pool before pagination).

## Smart album filters (`SmartAlbumFilters`)

Applied in SQL when listing places and items:

- **Text `query`:** matches titles/paths as implemented in `media-albums` queries.
- **People:** `personTagIds` with optional **`includeUnconfirmedFaces`** to include suggestion-linked rows, not only confirmed face tags.
- **Star rating:** `starRatingMin` + `starRatingOperator` (`gte` | `eq`).
- **AI aesthetic:** derived from `ai_metadata` JSON paths (normalized `photo_estetic_quality` / nested `image_analysis` shape).
- **`ratingLogic`:** `or` | `and` combining star and aesthetic predicates.
- **Dates:** `dateFrom` / `dateTo` on captured/taken timestamps (normalized via shared `normalizeAlbumDateBounds`).
- **`excludedImageCategories`:** lowercased AI `image_category` matched with literal or `*` → SQL `LIKE` wildcard. If omitted, **`DEFAULT_SMART_ALBUM_EXCLUDED_IMAGE_CATEGORIES`** applies (documents, screenshots, diagrams, etc.) so smart surfaces focus on “real” photos unless the user clears patterns.

## Smart albums — year summaries

- **`listSmartAlbumYears`** returns per-year aggregates: total count, how many items qualify as manually rated / AI-rated (for badges or sorting), and a suggested cover path for the card.

## IPC surface (main process)

Handlers in `electron/ipc/album-handlers.ts` map 1:1 to DB functions: list/create/update/delete albums, list/add/remove items, reorder, cover, list memberships for a media item, and smart list endpoints (`listSmartAlbumPlaces`, `listSmartAlbumYears`, `listSmartAlbumItems`).

## Client state (`@emk/media-store` + desktop)

- Album list, selection, and recent album ids are kept in shared/desktop store slices for responsive UI.
- Smart-specific UI state (expanded countries/groups, active leaf, filter object, randomize toggles, hierarchy level picker) lives in desktop hooks/components; it should reset or refetch when filters or root kind change (see implementation for exact invalidation rules).
