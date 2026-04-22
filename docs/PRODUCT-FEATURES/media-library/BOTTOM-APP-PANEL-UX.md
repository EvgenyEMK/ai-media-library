# BOTTOM APP PANEL UX

## Scope

This document defines interaction behavior for the bottom `Background operations` panel in `desktop-media`.

It applies to all operation cards shown in the panel:
- Media metadata scan
- Local AI analysis
- Local face detection
- AI search indexing
- **People tab: similar face counts** (live recomputation of per-tag untagged-similar counts for the current directory page — see [People face tags](../AI/PEOPLE-FACE-TAGS.md))
- **AI description embedding** (temporary backfill job — see [Folder analytics menu](./FOLDER-ANALYTICS-MENU-UX.md) §9 and [AI search (desktop)](../AI/AI-SEARCH-DESKTOP.md))

---

## 1) Card Header Action Icon Rules

Each operation card has one primary action icon in its header:
- Always show **`X`** (single consistent icon).

Behavior depends on card state:
- **Running (not completed):**
  - Clicking `X` must cancel the operation.
  - Clicking `X` must also close/hide the card immediately.
- **Completed / ended (completed, failed, cancelled):**
  - Clicking `X` closes/hides the card only.
  - No process action is triggered.

---

## 2) Card-Specific Cancel Actions

- **Media metadata scan** running card stop action:
  - invokes metadata scan cancellation.
- **Local AI analysis** running card stop action:
  - invokes photo analysis cancellation.
- **Local face detection** running card stop action:
  - invokes face detection cancellation.
- **AI search indexing** running card stop action:
  - invokes semantic indexing cancellation.
- **AI description embedding** running card stop action:
  - invokes description-embedding backfill cancellation (temporary feature; same `X` = cancel + hide while running).
- **People tab: similar face counts** running card stop action:
  - invokes `cancelSimilarUntaggedFaceCountsJob` (main process sets a cancel flag; the job yields between tags so cancel can take effect after the current tag’s synchronous count finishes).

All cards follow the same single-icon rule from section 1.

---

## 3) Consistency Requirements

- Header icon semantics must be identical across all operation cards.
- Users must always see the same `X` icon regardless of state.
- While running, `X` means `cancel + hide`.
- After completion, `X` means `hide only`.

---

## 4) Time left (ETA) rules

Some operation cards may show a `Time left` value in the summary line while running.

### When it is shown

- `Time left` appears only after the app has enough real measurements to estimate speed.
- At the beginning of a job (when there are not enough completed items yet), `Time left` may be hidden.

### How it is calculated (user-facing behavior)

- The estimate is based on the **recent processing speed** from the latest completed files (rolling sample, up to ~15 files).
- `Time left` is recalculated as the job runs, so it can **go down or up** when processing speed changes.
- For readability and stability, the displayed `Time left` is **rounded up to the next full minute**.

### How it is displayed

- The value is shown as a compact duration (e.g. `3min`, `1h`, `1h20min`).
- In running cards, counters stay on the **left** side of the summary line and `Time left` is aligned to the **right** side when available.
- If the estimate is unavailable, invalid, or effectively zero, the `Time left` label is omitted (to avoid flicker and misleading “0 min” states).

---

## 4) Metadata Scan Auto-Show / Auto-Hide on Folder Selection

When the user selects a folder, a non-recursive metadata scan may be automatically
triggered for that folder. The progress card behavior is designed to avoid visual
noise for fast scans while still giving feedback for slower ones, while preserving
manually started scans.

### Expected behavior

1. **Folder images load** -- the renderer shows a "Loading folder photos..."
   spinner with a running count while images are streamed in batches.
2. **Auto-scan starts immediately after loading** -- as soon as image streaming
   completes, the metadata scan card appears with no perceptible gap (when auto-scan is allowed).
3. **Single progress bar, two phases** -- the same progress card transitions
   through:
   - **Preparing files** (user-friendly label for file identity check and
     change detection)
   - **Scanning metadata** (database upsert and created/updated/unchanged
     classification)
   The progress bar advances during both phases so it does not appear frozen
   on large folders.
4. **Scan completes with no new or updated files** -- the card is automatically
   hidden. The hide happens with a configurable delay (currently 0 ms) so that
   fast scans (unchanged files) disappear instantly and do not clutter the UI.
5. **Scan completes with new or updated files** -- the card remains visible so
   the user can review the summary (created / updated counts). It must be
   dismissed manually via the `X` icon.
6. **Manual scan continuity over folder selection** -- if a metadata scan was started
   manually (folder menu or main-pane action menu), selecting another folder does
   **not** cancel that scan. The running manual scan continues in Background operations.
7. **Auto-scan skip while manual scan is running** -- if a manual scan is running and the
   user selects a different folder, the newly selected folder's auto metadata scan is skipped.
   Folder content still loads so the user can continue browsing while the manual scan runs.

### Design rationale

- Most folder selections result in scans that complete in single-digit
  milliseconds (all files unchanged). Showing a progress bar that flashes for
  one frame adds visual noise without informing the user.
- For longer scans (4-5+ seconds), the progress bar is important feedback. The
  scan card appears immediately after the folder loading spinner disappears, so
  the user always sees continuous feedback: spinner then progress bar then
  auto-hide (or stay if changes were found). There is no silent gap between
  the two indicators.
- The auto-hide delay (`METADATA_AUTO_HIDE_DELAY_MS` in the codebase) can be
  increased if future UX testing shows users need more time to notice the
  completed state.

### Performance: avoiding redundant work

When a folder is selected, the main process already enumerates image files to
stream them to the renderer. The metadata scan reuses this file list directly
(`knownImageEntries`) rather than re-reading the directory. The file identity
observation pass (stat + SHA-256 hashing) is executed once and feeds the first
progress phase (`Preparing files`), then the scan moves to the second phase
(`Scanning metadata`). This matters on large folders (1000+ images) where the
identity step can take several seconds.

### Manually triggered scans ("Scan subfolders")

The same auto-hide logic applies after completion. Manual scans may be recursive,
so they use the full directory enumeration + observe pipeline. The renderer also
resets the collapsed state of the progress panel immediately when the user clicks
the button, ensuring the dock is visible before the first IPC event arrives.

Manual scans are treated as user-owned jobs:
- They continue across folder selection changes.
- Automatic folder-selection metadata scans never interrupt them.

---

## 5) People tab — similar face counts job (auto-hide on success)

When the user clicks **Refresh** on the **People** directory tab, a short-lived job
recomputes “Similar faces” counts for the **current page** of person tags.

### Expected behavior

1. **Card appears** when the main process emits `job-started` (panel visibility is set by the progress binder).
2. **Progress bar** advances **per person tag** processed (not sub-steps inside one tag’s query).
3. **Cancel (`X`) while running** requests cancellation; the job checks the flag **between** tags (after yielding to the event loop). A single tag’s count may still run to completion before cancel applies.
4. **Successful completion** — the card **auto-hides** after a short delay (currently **0 ms**, same idea as metadata scan when there are no catalog changes). Counts remain in renderer/store for the table.
5. **Failed** — error text is shown; the user dismisses with `X`.
6. **Cancelled** — optional summary; user dismisses with `X`.

### Design rationale

- Avoids firing heavy vector queries on every tab or page change; the default column uses the **database cache** until the user explicitly refreshes (product: [People face tags](../AI/PEOPLE-FACE-TAGS.md)).
