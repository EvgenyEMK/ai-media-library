---
name: Folder AI summary fixes
overview: Fix the summary view to show recursive sub-folder counts, harden recursive folder/image enumeration for face detection and other AI pipelines (including the same "too many SQL variables" bug already fixed for semantic search), and rename the scan menu item.
todos:
  - id: summary-recursive
    content: "Change summary sub-folder rows and self to use recursive: true; update note text in DesktopFolderAiSummaryView.tsx"
    status: completed
  - id: chunk-in-queries
    content: Apply chunked IN (?) pattern to getAlreadyFaceDetectedPhotoPaths and getAlreadyAnalyzedPhotoPaths in media-analysis.ts
    status: completed
  - id: harden-folder-enum
    content: Add try/catch around listFolderImages in face-detection-handlers.ts and photo-analysis-handlers.ts; add warning log in collectFoldersRecursively catch block
    status: completed
  - id: ensure-catalog
    content: Add ensureCatalogForImages helper in folder-utils.ts; call from face/photo/semantic handlers before filtering missing items
    status: completed
  - id: rename-menu-item
    content: Rename 'Scan tree for changes' to 'Scan tree for file changes' in SidebarTree.tsx
    status: completed
isProject: false
---

# Folder AI summary and recursive analysis fixes

## Issue 1 — Summary sub-folder rows should count recursively

Currently, `[folder-ai-summary-handlers.ts](apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts)` calls `getFolderAiCoverage({ folderPath: node.path, recursive: false })` for each child folder. Each row only counts images directly in that folder, not in its subtree.

**Fix:**

- Change both `self` and each subfolder row to use `recursive: true` in `folder-ai-summary-handlers.ts`.
- Update the note text in `[DesktopFolderAiSummaryView.tsx](apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx)` (line ~102) to reflect the new counting. Something like: "Counts include all image files in each folder and its sub-folders."

## Issue 2 — Face detection (and photo analysis) may fail silently on large folders

Two bugs in the same family as the semantic-search `IN (...)` overflow fixed earlier:

### 2a. `getAlreadyFaceDetectedPhotoPaths` / `getAlreadyAnalyzedPhotoPaths` unbounded `IN (?)`

Both functions in `[media-analysis.ts](apps/desktop-media/electron/db/media-analysis.ts)` build `source_path IN (${placeholders})` for all image paths in a single folder. A folder with 1000+ images exceeds SQLite's 999-variable limit, crashing the entire IPC handler. These are called per-folder, so while less likely than the aggregate case, it is still reachable.

**Fix:** Apply the same chunking pattern used in `semantic-search.ts` (batch paths in groups of ~900, merge results).

### 2b. Face/photo handlers don't wrap `listFolderImages` in try/catch

In `[face-detection-handlers.ts](apps/desktop-media/electron/ipc/face-detection-handlers.ts)` (line 68) and `[photo-analysis-handlers.ts](apps/desktop-media/electron/ipc/photo-analysis-handlers.ts)` (line 52), `listFolderImages(folder)` is called bare inside a `for (const folder of folders)` loop. If any single folder read throws (permissions, long path, etc.), the whole job fails instead of skipping that folder. By contrast, `[collectImageEntriesForFolders](apps/desktop-media/electron/ipc/folder-utils.ts)` wraps each call in try/catch.

**Fix:** Wrap `listFolderImages(folder)` in try/catch in both handlers' folder loops, logging a warning and continuing to the next folder (matching `collectImageEntriesForFolders` behavior).

### 2c. `collectFoldersRecursively` silently swallows errors

In `[folder-utils.ts](apps/desktop-media/electron/ipc/folder-utils.ts)` line 20, the catch is completely empty. If `readFolderChildren` fails for an intermediate directory, the entire subtree below it is silently lost from the job, yet the job "completes" successfully (with a smaller total).

**Fix:** Log a warning in the catch block with the folder path and error message so the user can diagnose missing subtrees:

```typescript
catch (err) {
  console.warn(
    `[folder-utils] readFolderChildren failed for ${current}: ${err instanceof Error ? err.message : String(err)}`,
  );
}
```

## Issue 3 — Auto-scan before AI analysis (architecture improvement)

Currently AI pipelines (face, photo, semantic) enumerate images from the filesystem via `listFolderImages`, independent of whether those files have `media_items` rows. The Folder AI summary view, however, derives its counts from `media_items`, so if a user runs face detection without ever running "Scan tree for file changes," the summary may show stale or empty counts. Additionally, the invalidation logic (clearing `photo_analysis_processed_at` / `face_detection_processed_at` on content changes) only fires during a metadata scan.

**Proposed approach — lightweight, non-blocking:**

Rather than auto-running a full metadata scan (which can be slow on large trees), add a pre-flight check at the start of each AI handler (face, photo, semantic) that runs a fast metadata scan for any images that are **not yet in `media_items`** (i.e., files on disk with no DB row). This is the "ensure catalog" step:

1. Add a new helper `ensureCatalogForImages(entries)` in `folder-utils.ts` that, for a batch of `{ path, folderPath }` entries, checks which paths have no `media_items` row (`SELECT source_path FROM media_items WHERE source_path IN (...)` — chunked), and for missing paths calls `upsertMediaItemFromFilePath` to create minimal rows. This ensures coverage queries reflect reality.
2. Call `ensureCatalogForImages` after collecting the image list in each AI handler but before filtering "missing" items.
3. This is fast (only inserts rows for truly new files, no full metadata extraction) and makes the summary immediately accurate after an AI run.

**Why not a full scan:** A full `runMetadataScanJob` includes file-identity observation, metadata extraction from EXIF, and reconciliation — too heavyweight as a silent pre-flight. The "ensure catalog" approach is minimal: just guarantee a `media_items` row exists so aggregate queries work.

## Issue 4 — Rename menu item

In `[SidebarTree.tsx](apps/desktop-media/src/renderer/components/SidebarTree.tsx)`, change the hardcoded string `"Scan tree for changes"` to `"Scan tree for file changes"`.

---

## Files to modify

- `[apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts](apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts)` — recursive: true for subfolder rows
- `[apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx](apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx)` — update note text
- `[apps/desktop-media/electron/db/media-analysis.ts](apps/desktop-media/electron/db/media-analysis.ts)` — chunk `IN (?)` queries
- `[apps/desktop-media/electron/ipc/face-detection-handlers.ts](apps/desktop-media/electron/ipc/face-detection-handlers.ts)` — try/catch around `listFolderImages`
- `[apps/desktop-media/electron/ipc/photo-analysis-handlers.ts](apps/desktop-media/electron/ipc/photo-analysis-handlers.ts)` — try/catch around `listFolderImages`
- `[apps/desktop-media/electron/ipc/folder-utils.ts](apps/desktop-media/electron/ipc/folder-utils.ts)` — log in catch; add `ensureCatalogForImages`
- `[apps/desktop-media/electron/ipc/semantic-search-handlers.ts](apps/desktop-media/electron/ipc/semantic-search-handlers.ts)` — call `ensureCatalogForImages`
- `[apps/desktop-media/src/renderer/components/SidebarTree.tsx](apps/desktop-media/src/renderer/components/SidebarTree.tsx)` — rename menu item

