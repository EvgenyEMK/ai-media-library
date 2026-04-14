---
name: AI pipeline metadata and status
overview: Ensure AI pipelines check for metadata before processing each image, add per-pipeline failed status columns to the DB, simplify the coverage SQL by removing the metadata freshness check, and update the Folder AI summary UI to show failed counts and red "not done" indicators.
todos:
  - id: metadata-helper
    content: Create ensureMetadataForImage helper in folder-utils.ts and integrate into all 3 pipeline worker loops
    status: completed
  - id: remove-freshness-check
    content: "Simplify coverage SQL in folder-ai-coverage.ts: remove metadata_extracted_at freshness comparison for all pipelines; remove debug log function"
    status: completed
  - id: failed-columns
    content: Add face_detection_failed_at/error and photo_analysis_failed_at/error columns via migration + reconcile in client.ts
    status: completed
  - id: write-failure
    content: Add markFaceDetectionFailed and markPhotoAnalysisFailed in media-analysis.ts; call from pipeline catch blocks; clear on success in upsert functions
    status: completed
  - id: coverage-failed-counts
    content: Add face_failed, photo_failed, semantic_failed to coverage SQL and update FolderAiPipelineCounts type + toPipelineCounts
    status: completed
  - id: ui-failed-line
    content: Add failed count line (amber) to PipelineStatusCell and red not_done styling; add CSS classes and UI text
    status: completed
isProject: false
---

# AI Pipeline Metadata Pre-check, Failed Status, and Summary Improvements

## 1. Inline metadata check before each AI pipeline processes an image

All three pipelines (face detection, photo analysis, semantic indexing) use `ensureCatalogForImages` which only creates stub rows without `metadata_extracted_at`. Each pipeline's worker loop should check if the image has metadata and, if not, run a lightweight metadata extraction inline before processing.

**Shared helper** in [folder-utils.ts](apps/desktop-media/electron/ipc/folder-utils.ts):

Create `ensureMetadataForImage(imagePath: string)` that:

- Queries `media_items` for `metadata_extracted_at IS NOT NULL` for the given `source_path`
- If null, calls `upsertMediaItemFromFilePath({ filePath: imagePath })` from [media-item-metadata.ts](apps/desktop-media/electron/db/media-item-metadata.ts)
- Returns void (fire and forget; errors logged but do not block the pipeline)

**Call sites** (inline, per-image, before the AI processing call):

- [face-detection-handlers.ts](apps/desktop-media/electron/ipc/face-detection-handlers.ts) `runFaceDetectionJob` worker loop, before `detectFacesInPhoto`
- [photo-analysis-handlers.ts](apps/desktop-media/electron/ipc/photo-analysis-handlers.ts) `runPhotoAnalysisJob` worker loop, before `analyzePhotoWithOptionalTwoPass`
- [semantic-search-handlers.ts](apps/desktop-media/electron/ipc/semantic-search-handlers.ts) `runSemanticIndexJob` worker loop, before `embedImageDirect`

## 2. Remove metadata freshness check from coverage SQL

In [folder-ai-coverage.ts](apps/desktop-media/electron/db/folder-ai-coverage.ts), both `getFolderAiCoverage` and `getFolderAiRollupsForPaths` use freshness conditions like:

```sql
WHEN mi.face_detection_processed_at IS NOT NULL
  AND (mi.metadata_extracted_at IS NULL
       OR mi.face_detection_processed_at >= mi.metadata_extracted_at)
```

**Simplify all three pipeline conditions** to just check the timestamp (and new failed columns -- see below):

- `photo_done`: `mi.photo_analysis_processed_at IS NOT NULL`
- `face_done`: `mi.face_detection_processed_at IS NOT NULL`
- `semantic_done`: `EXISTS (... me.embedding_status = 'ready' ...)`  -- drop the `metadata_extracted_at` comparison from the subquery

Apply the same simplification in both `getFolderAiCoverage` (single-folder query) and `getFolderAiRollupsForPaths` (batched rollup query).

Also remove the temporary `debugLogFaceDetectionNotDoneForFolderScope` function and its call in [folder-ai-summary-handlers.ts](apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts).

## 3. Add per-pipeline failed status columns to `media_items`

### 3.1 New columns

Add to `media_items` (via a new migration in [client.ts](apps/desktop-media/electron/db/client.ts) migrations array + `reconcileCriticalSchema`):

- `face_detection_failed_at TEXT` -- ISO timestamp of last failure
- `face_detection_error TEXT` -- error message (truncated to ~500 chars)
- `photo_analysis_failed_at TEXT` -- ISO timestamp of last failure
- `photo_analysis_error TEXT` -- error message

(Semantic indexing already has `embedding_status = 'failed'` + `last_error` on `media_embeddings`, so no new columns needed for that pipeline.)

### 3.2 Write failure on error

- **Face detection** ([face-detection-handlers.ts](apps/desktop-media/electron/ipc/face-detection-handlers.ts) `runFaceDetectionJob` catch block): call a new `markFaceDetectionFailed(imagePath, errorMessage)` in [media-analysis.ts](apps/desktop-media/electron/db/media-analysis.ts) that sets `face_detection_failed_at = now`, `face_detection_error = <message>`.
- **Photo analysis** ([photo-analysis-handlers.ts](apps/desktop-media/electron/ipc/photo-analysis-handlers.ts) catch block): call a new `markPhotoAnalysisFailed(imagePath, errorMessage)` that sets `photo_analysis_failed_at = now`, `photo_analysis_error = <message>`.
- On **success**, clear the failed columns: `upsertFaceDetectionResult` should set `face_detection_failed_at = NULL, face_detection_error = NULL`; `upsertPhotoAnalysisResult` should set `photo_analysis_failed_at = NULL, photo_analysis_error = NULL`.

### 3.3 Coverage queries: add failed counts

In both `getFolderAiCoverage` and `getFolderAiRollupsForPaths` SQL, add:

```sql
SUM(CASE WHEN mi.face_detection_failed_at IS NOT NULL AND mi.face_detection_processed_at IS NULL THEN 1 ELSE 0 END) AS face_failed,
SUM(CASE WHEN mi.photo_analysis_failed_at IS NOT NULL AND mi.photo_analysis_processed_at IS NULL THEN 1 ELSE 0 END) AS photo_failed,
SUM(CASE WHEN EXISTS (
  SELECT 1 FROM media_embeddings me
  WHERE me.media_item_id = mi.id AND me.library_id = mi.library_id
    AND me.embedding_type = 'image' AND me.model_version = ?
    AND me.embedding_status = 'failed'
) THEN 1 ELSE 0 END) AS semantic_failed
```

### 3.4 Update types in [ipc.ts](apps/desktop-media/src/shared/ipc.ts)

Extend `FolderAiPipelineCounts`:

```typescript
export interface FolderAiPipelineCounts {
  doneCount: number;
  failedCount: number;  // NEW
  totalImages: number;
  label: FolderAiPipelineLabel;
}
```

Update `toPipelineCounts` to accept and pass through `failedCount`.

## 4. UI changes in Folder AI summary

### 4.1 Failed indicator in pipeline cells

In [DesktopFolderAiSummaryView.tsx](apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx) `PipelineStatusCell`:

- After the main status line (done checkmark, partial %, or em dash), if `pipeline.failedCount > 0`, render a second line:

```
  Failed: <percent>% (<count>)
  

```

  in amber color (`color: #f59e0b` or a new `--warning` CSS variable `38 92% 50%`).

- Add CSS class `folder-ai-summary-status-failed-line` in [styles.css](apps/desktop-media/src/renderer/styles.css).

### 4.2 Red "not done" for non-empty folders

Currently, `not_done` and `empty` both render `—` with class `folder-ai-summary-status-empty` (muted foreground color).

- Change `PipelineStatusCell` to distinguish `label === "not_done"` from `label === "empty"`:
  - `not_done` (and `totalImages > 0`): render `—` with class `folder-ai-summary-status-not-done` using `color: hsl(var(--destructive))` (red)
  - `empty` (or `totalImages === 0`): keep current `—` with `folder-ai-summary-status-empty` (muted)

### 4.3 UI text additions in [ui-text.ts](apps/desktop-media/src/renderer/lib/ui-text.ts)

- `folderAiSummaryStatusFailed: "Failed"` (for tooltip on the amber line)

## 5. Invalidation cleanup

In [media-ai-invalidation.ts](apps/desktop-media/electron/db/media-ai-invalidation.ts), also clear the new failed columns when invalidating:

```sql
SET photo_analysis_processed_at = NULL,
    photo_analysis_failed_at = NULL,
    photo_analysis_error = NULL,
    face_detection_processed_at = NULL,
    face_detection_failed_at = NULL,
    face_detection_error = NULL,
    updated_at = ?
```

