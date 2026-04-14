---
name: Fix Image AI analysis readiness+cancel
overview: "Investigate and fix two bugs in Desktop Media \"Image AI analysis\": early failures due to Ollama/Qwen not ready after app start, and UI getting stuck after cancel (folder content never loads and menu still shows in-progress)."
todos:
  - id: warmup-qwen
    content: Add Ollama/Qwen warmup + transient retry so startup doesn’t create early failures.
    status: completed
  - id: cancel-jobid-gap
    content: Fix cancel during jobId-not-yet-known window (disable cancel or queue cancel in renderer).
    status: completed
  - id: cancel-clears-status
    content: Ensure main-process cancel clears folder in-progress status and emits completion/cancel signals.
    status: completed
  - id: finalize-ui-items
    content: Update photo progress binder to mark pending/running items as cancelled on completion, consistent with face/semantic.
    status: completed
isProject: false
---

# Fix Image AI analysis readiness + cancel bugs

## What I found (current code paths)

- **Menu action**: right-click folder context menu in `apps/desktop-media/src/renderer/components/SidebarTree.tsx` → `FolderAnalysisMenuSection` → `onAnalyzePhotos(...)` / `onCancelAnalysis()`.
- **Start analysis (renderer → main)**: `apps/desktop-media/src/renderer/App.tsx` `handleAnalyzePhotos()` calls `window.desktopApi.analyzeFolderPhotos(...)` (IPC `media:analyze-folder-photos`).
- **Job runner (main)**: `apps/desktop-media/electron/ipc/photo-analysis-handlers.ts` creates `jobId`, stores it in `runningJobs`, emits `photoAnalysisProgress job-started`, then runs `runPhotoAnalysisJob(...)` with N workers.
- **Qwen/Ollama call**: `apps/desktop-media/electron/photo-analysis.ts` posts to `http://localhost:11434/api/chat` with `model: "qwen3.5:9b"`.

## Bug 1: first ~60–70 images fail because Qwen/Ollama isn’t ready

### Likely cause

The photo analysis pipeline does **no readiness gate or warmup** before starting workers. First requests to Ollama can fail while Ollama is still starting / loading the model (common with large vision models), which turns into per-image `failed` items.

### Fix approach (mirror face-detection readiness + semantic warmup precedent)

- **Add a model warmup/readiness step** in main process before processing any real images.
  - Implement a singleton warmup promise (per model) similar to face/native lazy init: one in-flight warmup at a time; reset on failure so future attempts can retry.
  - Warmup should perform a minimal Ollama `/api/chat` call using a tiny embedded 1×1 (or small) image payload and a very small prompt, with a bounded timeout + a few retries/backoff (e.g. 3–5 attempts over ~30–60s).
- **Run warmup at job start** in `registerPhotoAnalysisHandlers()` right before `void runPhotoAnalysisJob(...)`.
  - If warmup fails: emit a clear `job-completed` with 0 processed + all cancelled/failed (or introduce a new `job-failed` event) so the UI doesn’t show dozens of failed items.
- **Add targeted transient retry** inside `runWorker()` for specific “not ready” errors (connection refused, fetch failed, 5xx) so brief startup flakiness doesn’t mark items as permanently failed.

Files involved:

- `apps/desktop-media/electron/photo-analysis.ts` (add `warmupOllamaVisionModel(...)` + classify transient errors)
- `apps/desktop-media/electron/ipc/photo-analysis-handlers.ts` (call warmup before running workers)

## Bug 2: cancel leaves UI stuck; context-menu still shows in-progress

### Likely causes (both are present)

- **Cancel can be a no-op if clicked too early**: renderer `handleCancelAnalysis()` returns immediately when `aiJobId` is null (`apps/desktop-media/src/renderer/App.tsx`). There’s a window where UI shows “running” but jobId hasn’t been stored yet.
- **Main cancel handler doesn’t clear folder “in progress” status**: `IPC_CHANNELS.cancelPhotoAnalysis` sets `job.cancelled=true` and aborts controllers but doesn’t call `setFolderAnalysisInProgress(..., false)`; that only happens at end of `runPhotoAnalysisJob()`.
- **Photo progress binder doesn’t finalize pending/running items as cancelled**: unlike face/semantic binders, `bindPhotoAnalysisProgress` leaves `pending/running` items untouched on `job-completed`, which can keep progress UI inconsistent.

### Fix approach

- **Renderer: make cancel reliable even before `jobId` is known**
  - Option A (simple): disable cancel button until `aiJobId` is set.
  - Option B (best UX): support “queued cancel” — if user cancels while `aiStatus==='running'` and `aiJobId` is null, set a flag; once `analyzeFolderPhotos` resolves (or `job-started` arrives), immediately send cancel.
- **Main: clear folder in-progress status on cancel**
  - Store `rootFolderPath` on the `RunningAnalysisJob` (extend type) when job is created.
  - In `cancelPhotoAnalysis` handler: call `setFolderAnalysisInProgress(rootFolderPath, 'photo', false)` and optionally `markFolderAnalyzed` only if any work completed.
  - Emit a lightweight progress event to prompt UI refresh (either reuse `job-completed` semantics or add `job-cancelled`), then ensure `runningJobs.delete(jobId)` happens promptly.
- **Renderer binder: finalize items on completion**
  - In `apps/desktop-media/src/renderer/hooks/ipc-progress-binders.ts` `bindPhotoAnalysisProgress`, on `job-completed`, convert remaining `pending/running` items to `cancelled` (same pattern as face/semantic) and set `aiStatus` accordingly.

Files involved:

- `apps/desktop-media/src/renderer/App.tsx`
- `apps/desktop-media/src/renderer/components/FolderAnalysisMenuSection.tsx` (if disabling the cancel button is chosen)
- `apps/desktop-media/src/renderer/hooks/ipc-progress-binders.ts`
- `apps/desktop-media/electron/ipc/photo-analysis-handlers.ts`
- `apps/desktop-media/electron/ipc/types.ts` / `apps/desktop-media/electron/ipc/state.ts` (job shape)

## Verification plan (no new tooling required)

- Start app → immediately run Image AI analysis → confirm **no early wave of failed items**; progress should wait (briefly) for warmup and then proceed.
- Cancel immediately after starting (including before any progress is shown) → confirm:
  - Folder view remains responsive (no stuck “Loading folder photos… 0”).
  - AI strip stops showing “Updating AI status…” indefinitely.
  - Context-menu no longer shows analysis as in-progress.
  - Background operations panel shows job ended/cancelled, and pending items are marked cancelled not stuck in running.

