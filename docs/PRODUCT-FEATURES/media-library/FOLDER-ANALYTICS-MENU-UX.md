# FOLDER ANALYTICS MENU UX

## Scope

This document defines the product UX and business logic for the folder-level analytics menu in `desktop-media`.

It covers:
- The top-right `More actions` (`...`) menu behavior in folder content view
- The **sidebar folder row** context menu (`…` or right-click), which exposes the same folder-scoped analytics controls for the row’s folder
- The `Folder AI analysis summary` action from the sidebar row menu
- Face detection controls and runtime behavior
- Photo AI analysis controls and runtime behavior
- AI search indexing controls and runtime behavior
- **Temporary** “AI description embedding” backfill (migration)
- How indexing relates to **hybrid AI search** at query time (see [AI search (desktop)](../AI/AI-SEARCH-DESKTOP.md))
- Recursive folder processing rules
- Progress reporting behavior in the bottom operations panel
- **Folder AI analysis summary** (full-screen table from the sidebar folder row menu)

---

## 1) Entry Point and Menu Behavior

- The menu is opened from the top-right `More actions` icon button in the folder content header.
- The menu closes when:
  - User clicks the `More actions` button again, or
  - User clicks outside the menu area.
- Menu rows use larger click targets and readable text sizing for accessibility.

Primary expandable rows:
1. `Face detection`
2. `Photo AI analysis`
3. `Index images for AI search`

Additional row (not expandable; migration-only — see §9):
4. `AI description embedding`

Each expandable row includes:
- Left-side expand/collapse chevron
- Title text
- Right-side Play/Pause control

---

## 2) Shared UX Pattern (Face + Photo AI + AI Search Index)

All three analytics sections use the same control pattern:

- **Play state**:
  - Shows Play icon.
  - Starts the corresponding job with currently selected options.
- **Running state**:
  - Shows Pause icon plus spinner indicator (process is active).
  - Clicking Pause cancels the active job.
- **Include sub-folders**:
  - Checkbox, default `checked`.
  - If checked, selected folder is processed first, then sub-folders one by one.
- **Override existing**:
  - Checkbox, default `unchecked`.
  - If unchecked, run in `missing` mode (skip items already analyzed/detected).
  - If checked, run in `all` mode (process everything found in scope).

Play buttons are enabled when a folder is selected, even if the selected folder currently has zero direct photos, because photos may exist in sub-folders.

### 2.1 Catalog and metadata before AI (per image)

Before **Face detection**, **Photo AI analysis**, or **Index images for AI search** processes a given image file, the app ensures that **file metadata has been extracted** into the catalog for that path (same work as a normal metadata scan for that file). If the row exists only as a minimal stub (no metadata yet), extraction runs **for that image** immediately before the AI step. This keeps catalog timestamps and AI completion markers aligned without requiring the user to run **Scan for file changes** first.

Errors during that inline metadata step are logged; the AI step may still run afterward depending on the failure mode.

---

## 3) Face Detection: Business Logic

### 3.1 Start Request

Face detection job request includes:
- `folderPath`
- `recursive` (from `Include sub-folders`)
- `mode`:
  - `missing` when `Override existing = false`
  - `all` when `Override existing = true`
- Face detection settings and concurrency

### 3.2 Scope Resolution

- If `recursive = false`: process selected folder only.
- If `recursive = true`: collect folder tree and process:
  1. selected folder first
  2. child folders in traversal order

### 3.3 Skip Rules (`missing` mode)

A photo is skipped when the app considers face detection **already completed** for that path:

- In-memory per-folder processed set (current session), or
- Persisted DB: `face_detection_processed_at` is set for the media item (success marker).

If a later retry failure exists for a file that also has an older success timestamp, the latest failure wins for skip/coverage purposes; the item is not treated as current in `missing` mode until a newer successful run clears the failure marker.

Skipped items do not run face detection again unless **Override existing** is enabled.

### 3.4 Progress Semantics

- Progress total is calculated from all selected photos in final scope (selected folder + sub-folders when recursive).
- Progress item updates include `currentFolderPath`.
- Bottom panel title while running:
  - `Local face detection - <folder name>`

---

## 4) Photo AI Analysis: Business Logic

### 4.1 Start Request

Photo AI analysis request includes:
- `folderPath`
- `recursive` (from `Include sub-folders`)
- `mode`:
  - `missing` when `Override existing = false`
  - `all` when `Override existing = true`
- Model, thinking mode, concurrency

### 4.2 Scope Resolution

- If `recursive = false`: process selected folder only.
- If `recursive = true`: process selected folder first, then sub-folders one by one.

### 4.3 Skip Rules (`missing` mode)

A photo is skipped when the app considers photo AI **already completed** for that path:

- In-memory per-folder analyzed set (current session), or
- Persisted DB: `photo_analysis_processed_at` is set and stored AI metadata matches the expected “full analysis” signature for coverage/skip logic.

If a later retry failure exists for a file that also has an older success timestamp, the latest failure wins for skip/coverage purposes; the item is not treated as current in `missing` mode until a newer successful run clears the failure marker.

Skipped items do not run analysis again unless **Override existing** is enabled.

### 4.4 Progress Semantics

- Progress total is computed over all selected photos in full scope.
- Progress item updates include `currentFolderPath`.
- Bottom panel title while running:
  - `Local AI analysis - <folder name>`

---

## 5) AI Search Indexing: Business Logic

### 5.1 Start Request

AI search indexing request includes:
- `folderPath`
- `recursive` (from `Include sub-folders`)
- `mode`:
  - `missing` when `Override existing = false`
  - `all` when `Override existing = true`

### 5.2 Scope Resolution

- If `recursive = false`: process selected folder only.
- If `recursive = true`: process selected folder first, then sub-folders one by one.

### 5.3 Skip Rules (`missing` mode)

A photo is skipped when it already has a stored semantic image embedding in the local vector store.

### 5.4 Model Warmup and Robustness

- Before per-image indexing starts, the app warms up the local vision embedding pipeline.
- If image decoding fails in the default loader for a specific JPEG variant, a fallback decode path is used so indexing can continue for files that are otherwise displayable in the app.

### 5.5 Progress and Cancel Semantics

- Bottom panel title while running:
  - `AI search index - <folder name>`
- Start returns a job id immediately and processing continues in background.
- Cancel from either surface (menu row or background operations card) immediately finalizes the job and updates the UI as stopped.
- Remaining in-flight/pending items are shown as `Cancelled`.

### 5.6 Hybrid search at query time (not part of this job)

The **Index images for AI search** job only maintains **vision (image) embeddings** for semantic similarity. When the user runs an **AI image search**, the app merges **vision** and **description-vector** ranks with RRF; FTS5 keyword search may run in parallel for diagnostics only. Product behavior and prerequisites are documented in [AI search (desktop)](../AI/AI-SEARCH-DESKTOP.md).

---

## 6) Bottom Operations Panel Rules

- The bottom panel displays long-running operations and aggregate progress.
- For Face detection, Photo AI, and AI search indexing:
  - Progress bar is based on processed count / total scoped files
  - Scoped files include recursive sub-folders when enabled
  - Current folder label is derived from `currentFolderPath` in progress events
- Completion shows final counts and average seconds per file.

### 6.1 Time left (ETA)

When the job is running, the progress summary may include `Time left`.

- The estimate is computed from **recent real processing speed** (a small rolling sample of the most recently completed files, up to ~5).
- It is recalculated continuously during the run and may **go up or down** as conditions change (e.g. different file sizes, cache effects, throttling).
- For readability, the estimate is **rounded up to the next full minute**.
- If there is not enough data yet (very early in a run), the `Time left` label may be omitted.

---

## 7) UX Intent

This menu design optimizes for quick repeated analytics runs:
- One-click start/stop from the same row
- Explicit scope and overwrite controls
- Predictable recursive behavior
- Clear in-flight context via folder-aware progress title
- Consistent control language across Face detection, Photo AI analysis, and AI search indexing

---

## 8) Folder AI visibility (desktop-media)

### 7.1 Main panel pipeline strip

When a folder is selected, the header area shows **Face detection**, **AI photo analysis**, and **AI search index** status for **direct images only** in that folder (not nested sub-folders). Labels are **No images**, **Not done**, **Partial**, or **Done**, with `done/total` counts. Refresh updates from the catalog.

### 7.2 Sidebar tree icons

Each folder row shows a **subtree rollup** (all catalogued images under that path): checkmark when face + photo + search index are complete for every image; amber square when mixed; red-tinted square when work remains; gray square when there are no images; spinner when any AI job is in progress for that folder (from `folder_analysis_status`).

**Catalog touch highlight (sidebar amber outline)** — After a metadata scan completes, any folder where at least one file had a **created** or **updated** catalog row gets a subtle **amber outline**. That includes **metadata-only** refreshes (e.g. embedded title, description, ratings) that **do not** invalidate existing AI completion markers. This highlight is **independent** of the top follow-up banner.

**Clearing outlines** — Dismissing the **metadata scan AI follow-up** banner (§7.4) clears these highlights in the current implementation (shared store action). If no banner appeared (scan only touched metadata that did not require AI re-runs), the outline may remain until another flow clears catalog-change flags.

The sidebar rollup is optimized for **done / partial / not done** at a glance; it does **not** surface per-pipeline **failed** counts. For **Failed: % (n)** and red **not done** emphasis, use the **Folder AI analysis summary** (§7.3).

### 7.3 Folder AI analysis summary

From the **sidebar** folder row `…` menu (**Folder AI analysis summary**), the main content area switches to a dedicated summary view (not the photo grid).

If the user selects a folder with no direct media items and at least one child folder, the app can also open this same summary view automatically, controlled by **On empty folder selection show AI analysis status summary for subfolders**.

Opening this view is read-only by default: it must not start an automatic direct-folder metadata scan. Empty direct folders with child folders are excluded from folder-selection auto metadata scan, and opening the summary suppresses auto-scan even though it updates the selected folder and streams folder media state in the background.

The dashboard-first redesign, geo-location coverage, lazy details loading, and loading indicators are specified in [Folder AI Analysis Summary Dashboard PRD](./FOLDER-AI-ANALYSIS-SUMMARY-DASHBOARD-PRD.md). The historical table details below remain relevant for the **Details: AI pipelines** tab.

#### 7.3.1 Header and chrome

- **Single header row**: title **Folder AI analysis summary** on the left; on the right, **icon-only** actions:
  - **Refresh** (reloads the summary from the catalog).
  - **Close** (returns to the photo view for the selected folder — same outcome as “back to photos”; uses an **X** icon).
- The folder path is **not** repeated here; it remains visible in the app’s main header for the selected folder.
- A short note under the header explains data freshness: *“Based on last folders scan and AI analysis timestamps in database”* (matches in-app copy). In practice, the table reflects **success timestamps** and **recorded failures** in the local database (see §7.3.3).

#### 7.3.2 Table structure

Columns (left to right):

| Column | Content |
|--------|---------|
| **Folder** | Row label (see below), the selected folder’s **display name** when it has no immediate sub-folders, or an immediate sub-folder **name** (clickable when listed under **Sub-folders**) |
| **Images** | Total catalogued **image** files in scope for that row (see row types) |
| **Face detection** | Pipeline status for that row’s image set |
| **AI photo analysis** | Same |
| **AI search index** | Same |

**Row types**

- **If the selected folder has no immediate sub-folders on disk** (nothing to list under **Sub-folders**): a **single** data row, **visually emphasized**. The **Folder** column shows that folder’s **name** (last path segment), not the generic “This folder without sub-folders” label. **Images** and pipeline columns use **direct images only** in the selected folder (same scope as the former direct-only row; with no sub-folders, recursive totals match this scope).
- **If it has one or more immediate sub-folders**:

  1. **Total with sub-folders** — First row, **visually emphasized** (stronger label weight + subtle highlight). Counts and pipeline status use the **full subtree** of the selected folder: images in that folder **plus** all nested sub-folders (recursive).
  2. **This folder without sub-folders** — Second row. Same metrics but **direct images only** in the selected folder (no descendant folders).
  3. **Sub-folders** — Section divider row (uppercase label), then one row per **immediate** child folder of the selected folder. Each child row’s **Images** and pipelines are computed **recursively** for that child’s path (that folder + all of its nested sub-folders). The child **name** is a control that opens the same summary view for that folder (equivalent to choosing **Folder AI analysis summary** from that row’s sidebar menu).

#### 7.3.3 Pipeline status cells (per column)

**Coverage rules (business logic, not UI)**

For each image in scope, the summary counts **successful completion** from the local catalog:

- **Face detection** — Counted as done when the media item has a **successful** face-detection completion timestamp (`face_detection_processed_at` set). It is **not** required that metadata extraction happened before or after that timestamp for the percentage; the rule is simply “this pipeline completed successfully for this file.”
- **AI photo analysis** — Done when **successful** photo analysis completion timestamp (`photo_analysis_processed_at` set), with the same “success marker” idea.
- **AI search index** — Done when a **ready** semantic image embedding exists for the configured model version on that media item.

**Failures vs not started**

- **Face detection** and **AI photo analysis** can record a **last failure** (timestamp + short error text) when a run ends in error. Summary **failed** counts include images where the last failure timestamp is newer than or equal to the success timestamp, or where no success timestamp exists. Successful runs clear the failure marker, so the latest recorded state is what the summary shows.
- **AI search index** uses the embedding row’s **failed** status in the vector store for the same idea.

When a **metadata refresh** invalidates prior AI results for an item, success and failure markers for face detection and photo analysis are cleared together so the summary matches “needs re-run” state.

**Display rules**

- **Done** — Large **green check** icon only (no numeric suffix, no “Done” text in the cell). Tooltip may still describe “Done” for accessibility.
- **Partial** — Progress as **`NN%` (done count)**:
  - **`NN%`** is the **integer** percentage (rounded **down**), larger text.
  - **`(done count)`** is smaller, secondary text; count is the number of images considered complete for that pipeline in the row’s scope.
  - If the integer percentage would be **0** but some images are done, show **one decimal** (e.g. `0.1%`) so tiny progress is visible.
  - Optional **partial** icon (e.g. dashed circle) may appear beside the percent for scanability.
- **Failed line** — If at least one image in that row’s scope is counted as **failed** for that pipeline, a **second line** appears under the main status: **`Failed: NN% (count)`** in **amber** (warning color). Tooltip uses the word “Failed” for accessibility. Percent and count use the same formatting rules as partial progress (grouped counts; percentage rules as above).
- **Not done** — A single **long dash** (`—`):
  - When the row has **no images** in scope (**Images** = 0), the dash is **muted** (treated as not applicable / no work item).
  - When the row has **one or more images** but none are done for that pipeline, the dash is **red** (destructive color) so “work remaining” is obvious.

#### 7.3.4 Number formatting

- All **numeric counts** shown in the table (e.g. **Images**, partial **done** counts) use **grouped digits** with a **space** as the thousands separator (e.g. `23 000`), consistent with the in-app formatter.

#### 7.3.5 Relation to other surfaces

- The **main panel pipeline strip** (§7.1) remains **direct-only** for the selected folder. When the summary table includes **Total with sub-folders**, that row is the **recursive** rollup for the same pipelines; when the table shows only the single **folder name** row (no immediate sub-folders), that row aligns with **direct-only** scope and matches the strip’s notion of “this folder’s direct images.”
- Initial Summary tab data is loaded via lightweight aggregate coverage calls for the selected folder recursive and direct-only scopes. Row-level data for **Details: AI pipelines** and **Details: Geo-location** is lazy-loaded on first Details tab open via the desktop IPC summary report (`getFolderAiSummaryReport`), which returns both selected-folder scopes plus recursive coverage per immediate child folder.
- File-level star ratings (XMP / Windows EXIF, catalog column, FTS, quick filters): [File star rating](./FILE-STAR-RATING.md).

### 7.4 Metadata scan follow-up (AI pipelines)

**Business logic — when the banner appears**

The top banner (**“Catalog update detected”**) is shown **only** when the completed scan reports at least one file with **`needsAiPipelineFollowUp`** (aggregated as `filesNeedingAiPipelineFollowUp` on the metadata scan `job-completed` IPC event). That includes:

- **New catalog rows** — first-time `media_items` insert for the scan’s outcome (typically needs initial AI runs).
- **Catalog updates that invalidate prior AI** — when refreshed file identity / content / geometry triggers `invalidateMediaItemAiAfterMetadataRefresh` (guarded by `shouldInvalidateAiAfterCatalogUpdate` in the main process: e.g. content hash or dimensions change; not pure embedded-metadata edits that skip invalidation).

It is **not** shown when the only catalog writes are **updates that do not invalidate AI** (e.g. many XMP/embedded field refreshes that leave photo/face/vision-index markers valid). That includes **star-rating-only** (or other metadata-only) saves where decoded width/height/orientation are unchanged—even if the on-disk file hash changes because the container or XMP segment was rewritten.

**Counts in the banner**

The banner states how many files **may need AI pipelines** (new or invalidated-after-catalog), and how many **folders** contained at least one such file (`needsAiFollowUp` per folder). Those numbers are **not** the same as total **created + updated** catalog rows; the bottom progress summary still reflects full catalog activity.

**UX — actions**

When the banner is shown, it offers one-click runs: photo AI (missing), face detection (missing), and AI search indexing (missing) on the **scan root**, scoped recursively with “missing only” behavior (same as before).

### 7.5 Manual metadata scan continuity vs folder-selection auto-scan

When metadata scan is started manually (`Scan for file changes` from sidebar or main-pane actions):

- The scan is treated as a **manual background job** and continues even if the user selects another folder.
- Selecting another folder still loads that folder's content and keeps the UI interactive.
- While a manual metadata scan is running, folder-selection **auto metadata scan** for newly selected folders is **skipped**.
- Auto-scan cancellation-on-selection behavior applies only to **auto-started** metadata scans.

---

## 9) Temporary: AI description embedding (migration)

**Intent:** One-time or occasional backfill for libraries that already have **Photo AI analysis** (title/description in `ai_metadata`) but were analyzed **before** the app started writing **description text embeddings** automatically. This row is expected to be **removed** after users have migrated.

### 9.1 Entry points

- **Sidebar** folder row menu (`…` or right-click on a folder row).
- **More actions** (`...`) menu in the folder content header (same row; uses the **selected** folder).

### 9.2 Controls and scope

- **Not** an expandable row: there are no **Include sub-folders** / **Override existing** checkboxes.
- **Scope:** Always **recursive** under the target folder (the folder from the row menu, or the selected folder from the header menu).
- **Skip rule:** Only processes images that **lack** a description **text** embedding for the current multimodal model **and** have usable AI title/description text. Images that already have that embedding are **skipped** (idempotent re-runs).

### 9.3 What it does *not* do

- Does **not** change **Folder AI analysis summary** totals or pipeline columns (by design).
- Does **not** replace **Index images for AI search** (vision embeddings) or **Photo AI analysis**.

### 9.4 Progress and cancel

- A dedicated card appears in **Background operations**: title **AI description embedding**.
- While running, header **`X`** **cancels** the job (same mental model as other AI pipeline cards).
- After completion, failure, or cancel, **`X`** dismisses the card.
- Summary line shows processed/total, indexed, skipped, and failed counts as implemented.

### 9.5 Relation to ongoing analysis

For **new** or **re-run** photo analysis after this feature shipped, description text embeddings are created **automatically** when analysis completes; users only need this menu for **historical** gaps.
