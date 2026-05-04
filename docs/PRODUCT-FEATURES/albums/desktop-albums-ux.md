# Desktop albums — user experience

## Entry points

- **Main navigation:** the **Albums** control switches the main workspace to the albums experience (title **Albums** in the main panel).
- **Left sidebar — Albums block:** compact label **Albums** with collapsible subsections. Subsections start **collapsed by default** (except where app defaults explicitly expand “Recent”; see implementation defaults).

## Sidebar structure (Albums)

At the top, **Search albums** filters manual albums by title when the user types (case-insensitive); matching albums appear as buttons above the sections.

1. **RECENT** — up to 10 recently used manual albums. Selecting an album opens its detail view.
2. **ALL ALBUMS** — expanding this section invokes **show full album list** in the workspace (no per-row list inside the sidebar).
3. **SMART ALBUMS** — two nested collapsible groups:
   - **Best of Year | Month | Day** — contains one action row **Best of Year** → smart root `best-of-year` (year cards and best-of-year item grid).
   - **Countries** — two action rows:
     - **Country > Year > Area** → `country-year-area` (tree + optional year/area sub-view bar in the workspace).
     - **Country > Area > City** → `country-area-city`.

The type `SmartAlbumRootKind` also includes `ai-countries` for non-GPS place sourcing in workspace logic; it is not exposed as its own sidebar row in the current layout. Labels are defined in `DesktopSidebarAlbumsSection` (`UI_TEXT`).

## Manual albums

### List view

- **Create album** opens inline creation (placeholder **New album title**, **Create** confirms).
- Albums appear as selectable cards/rows with title and counts as implemented on the card component.
- **Search** (All Albums subsection): client-side title filter, case-insensitive.

### Album detail

- **Heading** shows the album title; **Back to albums** returns to the list.
- **Empty state:** copy such as “This album is empty.” when there are no items.
- **View modes:** grid and list; toggles follow the global desktop view mode pattern.
- **Quick filters** (thumbnail quick filters): when any filter is active, the content area can show a **no items match** state even if the album has items (filtered view).

### Reordering (manual albums only)

- In **grid** view, with **no active quick filters**, the user may **drag and drop** thumbnails to change **manual album order** (persisted server-side in the main process / SQLite).
- Reordering is **not** offered for smart album grids (dynamic queries; no stored positions) or when filters are active (indices would not match persisted order).

## Smart albums workspace

### Place-based roots

- Tree of **countries** → **groups** → **entries** depending on grouping (year/city/area/month variants). Expand/collapse is per-country and per-group.
- **Country > Year > Area** root exposes a **sub-view bar** (e.g. month/area vs year/area vs year/city) to switch how the tree is navigated without leaving the root.
- **Empty states:**
  - GPS: prompt to run metadata scan with GPS location detection when no GPS countries exist.
  - Non-GPS: message when no country-like non-GPS locations exist yet.

### Best of Year

- **Year cards** with counts and cover hints; opening a year shows a **paged grid** of items.
- **Randomize** (where implemented): reshuffles selection within configured candidate limits for variety.

### Smart filters panel

- Controls map to **star rating**, **AI aesthetic** score, **rating logic** (OR vs AND between star and AI thresholds), **people / face tags**, **include unconfirmed faces**, **date range**, text **query**, and **excluded AI image categories** (defaults exclude screenshots, documents, etc.; user can adjust in settings where exposed).
- Default filter presets may be driven by **app settings** (desktop settings merge into initial smart album filters).

## Cross-cutting UX

- **Loading:** brief “Loading smart albums…” style feedback while place/year data is fetched.
- **Pagination:** smart album item grids use page controls; manual album grids use the same content grid with page callbacks.
- **Viewer:** clicking an item opens the desktop media viewer with an appropriate item list override (album vs smart album context).
