---
name: Fix info panel initial stale state
overview: "Root cause is a lazy-load timing bug in the desktop viewer: metadata refresh and fallback face-box synthesis run only after the Face tags tab mounts, so Info/Face badge are stale on first open. The fix is to hydrate metadata and face-box state at viewer/panel mount, not inside tab content."
todos:
  - id: add-panel-hydration
    content: Hydrate metadata/boxes in DesktopViewerInfoPanel on item change
    status: pending
  - id: keep-tags-fallback-safe
    content: Retain Face tags fallback logic as secondary path only
    status: pending
  - id: optional-viewer-prefetch
    content: Prefetch metadata on viewer open for grid/list flow
    status: pending
  - id: verify-manual-flow
    content: Manually verify Info + Face tags initial state without tab switching
    status: pending
isProject: false
---

# Fix Desktop InfoPanel Initial Data Hydration

## Root Cause

- The desktop viewer passes `metadata` to `DesktopViewerInfoPanel` from `mediaMetadataByItemId[item.sourcePath]` in `[apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx)`.
- On first open, this map can still be empty for that image, so `DesktopViewerInfoPanel` renders the fallback message (`"Metadata is not available yet for this file."`) and `Face tags` badge count stays empty.
- `Face tags` content is lazily mounted by shared panel shell in `[packages/media-viewer/src/photo-with-info-panel.tsx](packages/media-viewer/src/photo-with-info-panel.tsx)` (only active tab content renders).
- In `[apps/desktop-media/src/renderer/components/DesktopFaceTagsTabContent.tsx](apps/desktop-media/src/renderer/components/DesktopFaceTagsTabContent.tsx)`, the effect that calls `onRefreshMetadataBoxes()` and synthesizes boxes from face instances runs only after that tab mounts. This explains why opening `Face tags` suddenly updates its count and then `Info` shows metadata.

## Implementation Plan

- In `[apps/desktop-media/src/renderer/components/DesktopViewerInfoPanel.tsx](apps/desktop-media/src/renderer/components/DesktopViewerInfoPanel.tsx)`, add an early hydration effect on `item.sourcePath` / `item.id` that:
  - invokes `onRefreshMetadata(item.sourcePath)` immediately when panel mounts for a new item,
  - derives boxes via `getPeopleBoundingBoxes(refreshed?.aiMetadata ?? null)`,
  - updates `currentBoundingBoxes` if non-empty.
- Keep `DesktopFaceTagsTabContent` as a defensive fallback, but remove dependency on it for first render correctness:
  - either keep its current refresh/synthesis effect as no-op when parent already hydrated,
  - or gate it behind `if (boundingBoxes.length === 0)` as it is now.
- Optionally (recommended for robustness), in `[apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx)` prefetch metadata when viewer opens from grid/list path (not only from People flow) so `renderViewerInfoPanel` receives warm data sooner.

## Why This Fix Matches Reported Behavior

- Initial `Info` empty: metadata map not hydrated yet.
- Initial `Face tags` label missing count: `badgeCount` is based on `currentBoundingBoxes`, which is empty until refresh/synthesis.
- Clicking `Face tags` makes it correct: tab mount triggers refresh/synthesis in `DesktopFaceTagsTabContent`.
- Returning to `Info` now shows data: parent rerender now has hydrated metadata.

## Validation

- Open image from regular folder grid/list with info panel visible:
  - `Info` tab should render metadata without requiring tab switch.
  - `Face tags` tab label should show count immediately when faces exist.
- Open image with no AI metadata but existing face instances:
  - Count should still populate after panel hydration fallback.
- Regressions:
  - Switching images should reset selection and not carry previous face selection.
  - No duplicate refresh loops (ensure hydration effect keyed to item identity).

