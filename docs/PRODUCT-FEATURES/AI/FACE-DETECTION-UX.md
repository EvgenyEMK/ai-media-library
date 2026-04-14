# FACE DETECTION UX

## Scope

This document defines the expected user experience for folder-level face detection in `desktop-media`.

It covers:
- How jobs are started from the action menu.
- How progress and counters are displayed in `Background operations`.
- How reruns behave for folders already processed.
- How cancellation behaves when the user presses Pause/Cancel.

---

## 1) Entry Point and Options

Face detection is started from the `...` actions menu in the media library header:
- `Face detection` row with Play/Pause action.
- Options:
  - `Include sub-folders`
  - `Override existing`

Mode behavior:
- `Override existing = false` uses `missing` mode.
- `Override existing = true` uses `all` mode.

---

## 2) Progress Surface

Face detection progress is shown in the bottom dock section:
- Panel title: `Background operations`.
- Card title: `Local face detection`.
- Progress bar plus summary line.

Summary line format:
- `Processed: X/Y | Skipped: S | Faces: F | Average: As/file`
- Optional suffixes shown only when non-zero:
  - `| Failed: N`
  - `| Cancelled: N`

Time left rules (when shown):
- `| Time left: T` may appear while the job is running.
- The value is based on the **recent observed speed** (latest completed files, small rolling sample).
- The estimate updates during the run and may **increase or decrease** as speed changes.
- `T` is **rounded up to the next full minute** for readability.

Counter rules:
- `Y` is the full file count in job scope (selected folder, plus subfolders when enabled).
- `X` is processed files (`success + failed + cancelled`).
- `Skipped` counts files that are already processed and therefore not re-detected in `missing` mode.
- `Faces` is the sum of detected faces from files processed in this run.

---

## 3) Rerun Behavior for Already Scanned Folders

When the user starts face detection again on a folder that was already processed, and `Override existing` is disabled:
- Job still includes all scoped files in progress accounting.
- Already processed files are immediately represented as processed/skipped.
- The user should see immediate non-zero totals such as:
  - `Processed: N/N | Skipped: N | Faces: 0 | Average: 0.00s/file`

This avoids misleading `0/0` progress for repeat runs.

---

## 4) Cancellation UX (Pause/Cancel)

When user presses Pause/Cancel during an active face detection run:
- Operation must stop immediately.
- Progress bar must move to completed state immediately.
- Remaining unprocessed files must be counted as `Cancelled` immediately.
- The UI must not continue to trickle file-by-file cancellation updates for a long tail.

Expected outcome:
- Final counters are emitted right away in one completion update.
- User gets immediate feedback that the cancellation request has fully applied.

---

## 5) State Expectations

- While running: folder analysis state is `in_progress`.
- On completion or cancellation: `in_progress` is cleared immediately.
- `faceAnalyzedAt` is updated only when at least one file was completed or failed by actual processing.

---

## 6) Close Button Behavior (`X`)

In the `Local face detection` card, the header icon is always `X` and behavior is state-based:
- If face detection is **running**:
  - clicking `X` cancels the face-detection job,
  - and hides the progress card immediately.
- If face detection is **not running** (completed/failed/cancelled):
  - clicking `X` hides the card only.

---

## 7) Edge Cases and Timing Expectations

- **Very large folders:** Initial totals can take noticeable time to appear because file discovery runs before full job accounting is emitted.
- **In-flight file on cancel:** One currently running file may still complete if cancellation arrives after processing has already passed the external cancel boundary.
- **Immediate UI completion on cancel:** Remaining pending/running files are rolled up as cancelled in one completion update; no long per-file cancellation tail should be visible.
- **All-files-already-processed rerun (`missing` mode):** Progress should resolve immediately to `Processed: N/N` and `Skipped: N` with average near `0.00s/file`.

