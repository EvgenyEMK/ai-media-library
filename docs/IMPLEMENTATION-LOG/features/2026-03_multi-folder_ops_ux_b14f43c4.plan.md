---
name: Multi-folder Ops UX
overview: Evaluate current desktop-media folder and progress UX, then propose proven multi-folder operation patterns with clear alternatives and a recommended flow grounded in similar apps.
todos:
  - id: map-current-ux
    content: Document current folder-action-progress flow and constraints from desktop-media code paths
    status: pending
  - id: define-alt-a
    content: Specify Alternative A interaction details, defaults, and confirmation behavior
    status: pending
  - id: define-alt-b-c
    content: Specify Alternative B/C flows for scalable multi-folder and queue-centric operation
    status: pending
  - id: recommend-roadmap
    content: Provide recommendation with phased rollout and validation criteria
    status: pending
isProject: false
---

# Multi-Folder Operations UX Proposal

## Current UX Baseline (from code/docs)

- Folder selection, content pane actions, and progress dock are primarily orchestrated in [C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/App.tsx](C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/App.tsx).
- Folder navigation state is single-selection (`selectedFolder`) in [C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/stores/desktop-slice.ts](C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/stores/desktop-slice.ts).
- Long-running job states are single-instance per operation type (AI/face/metadata) in:
  - [C:/EMK-Dev/emk-website/packages/media-store/src/slices/ai-analysis.ts](C:/EMK-Dev/emk-website/packages/media-store/src/slices/ai-analysis.ts)
  - [C:/EMK-Dev/emk-website/packages/media-store/src/slices/face-detection.ts](C:/EMK-Dev/emk-website/packages/media-store/src/slices/face-detection.ts)
  - [C:/EMK-Dev/emk-website/packages/media-store/src/slices/metadata-scan.ts](C:/EMK-Dev/emk-website/packages/media-store/src/slices/metadata-scan.ts)
- IPC contracts are folder-scoped (`folderPath`) in [C:/EMK-Dev/emk-website/apps/desktop-media/src/shared/ipc.ts](C:/EMK-Dev/emk-website/apps/desktop-media/src/shared/ipc.ts).
- Existing docs emphasize batch-friendly workflows and queue/backoff architecture:
  - [docs/PRODUCT-FEATURES/AI/PEOPLE-FACE-TAGS.md](docs/PRODUCT-FEATURES/AI/PEOPLE-FACE-TAGS.md)
  - [docs/ARCHITECTURE/desktop-first-mvp-architecture.md](docs/ARCHITECTURE/desktop-first-mvp-architecture.md)

## UX Best-Practice Inputs (external patterns)

- **PhotoPrism**: clear scope selector (subfolder vs all), explicit `Complete Rescan`, and guidance to avoid concurrent indexing.
- **digiKam**: incremental scans with “skip already scanned”, plus explicit “rescan/merge/reset” modes.
- **Google Photos**: background-first processing with low interruption; people management focuses on correction/merge rather than frequent manual reruns.

## UX Alternatives For Multi-Folder Operations

### Alternative A: Contextual Action + Scope Picker (lowest friction)

- Keep existing action location in content header (`Face detection`, `AI analysis`, `Metadata scan`).
- On action click, open a compact scope popover:
  - `This folder only`
  - `This folder + subfolders`
  - `Selected folders` (future when multi-select tree exists)
- Processing mode defaults to `**Only not yet analyzed`**; secondary option `Reprocess all`.
- Start immediately after confirmation; bottom panel shows a job card with scope summary.
- Best for power users already operating from folder context.

### Alternative B: Dedicated “Batch Operations” Drawer (best clarity at scale)

- Add a right-side drawer opened from toolbar (`Run batch operation`).
- Drawer has explicit steps:
  1. Choose operation (face/AI/metadata)
  2. Choose scope (folder tree with checkboxes, include subfolders toggle)
  3. Choose processing mode (`Only missing` default)
  4. Review estimate (items, expected time) and launch
- Bottom panel becomes **jobs monitor** only; drawer handles configuration.
- Best for upcoming true multi-folder and queued job workflows.

### Alternative C: Job Queue Center First (best for heavy background workflows)

- Promote bottom panel into a persistent “Jobs” center with queued/running/completed tabs.
- Folder pane actions create jobs with minimal options (`Quick run with defaults`) and optional `Customize...` link.
- Supports concurrency limits, priority ordering, retry failed, and templated presets.
- Best if desktop app is moving toward frequent background automation.

## Recommended Direction

- Start with **Alternative A now** (minimal UI disruption, fast delivery).
- Design data/UX model so it can evolve to **Alternative B** without rework:
  - Normalize job definition as `{ operationType, scope, mode, filters }`.
  - Treat folder as one possible scope input, not the only one.
  - Keep default mode `Only not yet analyzed` for all expensive operations.

## Proposed Interaction Model

```mermaid
flowchart LR
  userAction[UserStartsOperation] --> scopePick[PickScopeAndMode]
  scopePick --> reviewRun[ReviewAndRun]
  reviewRun --> jobQueue[CreateJobInQueue]
  jobQueue --> panel[BottomJobsPanel]
  panel --> openDetails[OpenJobDetails]
  openDetails --> retryFailed[RetryFailedOrRunAll]
```



## Key UX Rules For Multi-Folder Operations

- Default to **incremental/safe mode**: `Only missing` preselected.
- Always show operation scope in card title/subtitle (e.g., `Face detection: Family/2024 + 12 subfolders`).
- Keep progress visible independent of current folder context.
- Provide clear states: `Queued`, `Running`, `Paused` (future), `Completed`, `Completed with errors`, `Cancelled`.
- Support “retry failed only” before “re-run all”.
- Prevent accidental expensive reruns via confirmation when choosing `Reprocess all`.

## Delivery Phases

- **Phase 1 (short-term UX):** Add scope picker + default `Only missing` + clearer job card metadata.
- **Phase 2 (scalability):** Move to multi-job-per-operation state model and queue semantics.
- **Phase 3 (advanced):** Selected-folders batch, retry policies, scheduling/presets.

## Validation Plan

- UX success metrics:
  - Reduced accidental full reruns
  - Higher completion rate for long jobs
  - Lower cancellation due to mistaken scope
- Usability tests:
  - “Run face detection on this folder and subfolders, only missing”
  - “Switch folders while job runs and still find/understand progress”
  - “Recover from failed subset without full rerun”

