---
name: Fix scan cancel + search pause
overview: Fix metadata scan cancellation reliability when clicking X, and make semantic search pause running scans during query execution so they don't compete for I/O/CPU.
todos:
  - id: robust-cancel
    content: Make cancelMetadataScan IPC cancel ALL running scans + skip scanning phase after cancelled preparing
    status: completed
  - id: pause-type
    content: Add `paused` flag to RunningMetadataScanJob + add pause/resume helpers in state.ts
    status: pending
  - id: pause-observe
    content: Add isPaused callback to observeFiles with yield-while-paused logic in both loops
    status: pending
  - id: pause-scan-handler
    content: Add yield-while-paused logic to metadata scan handler scanning loop + pass isPaused to observeFiles
    status: pending
  - id: pause-search
    content: Wrap semanticSearchPhotos handler with pauseAllMetadataScans/resumeAllMetadataScans
    status: pending
  - id: verify
    content: Typecheck + build + lint + E2E tests
    status: pending
isProject: false
---

# Fix Metadata Scan Cancellation and Search-Scan Independence

## Problem Analysis

Two related issues:

1. **X button cancel is fragile**: The metadata card X button calls `cancelMetadataScan(metadataJobId)`, which cancels only ONE job by ID. If there's a stale `metadataJobId` (race between new job starting and renderer updating), the cancel misses the active job. Additionally, after the preparing loop exits due to cancellation, the code still runs `getObservedFileStateByPaths` for all entries and emits a "scanning" phase event -- unnecessary work.
2. **Search and scan I/O contention**: The scan's `observeFiles` reads ALL files for SHA-256 hashing (GB of data). When the search runs simultaneously (especially on first search when the text ONNX model loads), both compete for disk I/O and CPU, making the search take minutes instead of seconds.

## Solution

### A. Make cancel more robust

**File: [metadata-scan-handlers.ts](apps/desktop-media/electron/ipc/metadata-scan-handlers.ts)**

- Modify the `cancelMetadataScan` IPC handler (line 33) to cancel ALL running metadata scans, not just the one matching `jobId`. This matches the pattern already used in `runFolderImagesStream` (fs-handlers.ts line 127) and handles stale jobId edge cases.

```typescript
ipcMain.handle(IPC_CHANNELS.cancelMetadataScan, async (_event, jobId: string) => {
  const target = runningMetadataScanJobs.get(jobId);
  for (const job of runningMetadataScanJobs.values()) {
    job.cancelled = true;
  }
  return target != null;
});
```

- Add a `if (!job.cancelled)` guard before the scanning-phase block (line 132-140) so that after the preparing loop exits due to cancellation, we skip `getObservedFileStateByPaths` and the scanning loop entirely:

```typescript
if (!job.cancelled) {
  emitMetadataScanProgress({ type: "phase-updated", phase: "scanning", ... });
  const observedByPath = getObservedFileStateByPaths(...);
  // ... scanning loop ...
}
```

### B. Pause scans during search (suspend approach)

This implements the user's preferred option: search suspends the scan temporarily, and the scan auto-resumes after the search completes.

**File: [types.ts](apps/desktop-media/electron/ipc/types.ts)**

- Add `paused` flag to `RunningMetadataScanJob`:

```typescript
export interface RunningMetadataScanJob {
  cancelled: boolean;
  paused: boolean;
}
```

**File: [state.ts](apps/desktop-media/electron/ipc/state.ts)**

- Add helper functions `pauseAllMetadataScans()` and `resumeAllMetadataScans()`.

**File: [file-identity.ts](apps/desktop-media/electron/db/file-identity.ts)**

- Add an `isPaused?: () => boolean` callback parameter to `observeFiles` (alongside existing `isCancelled`).
- In the hash loop (line 141), add a yield-while-paused wait before each iteration:

```typescript
for (const item of observed) {
  if (isCancelled?.()) break;
  while (isPaused?.() && !isCancelled?.()) {
    await new Promise(r => setTimeout(r, 200));
  }
  if (isCancelled?.()) break;
  // ... hash + DB upsert ...
}
```

- Same pattern in the stat loop (line 45) for completeness, though stat is fast.

**File: [metadata-scan-handlers.ts](apps/desktop-media/electron/ipc/metadata-scan-handlers.ts)**

- Pass `() => job.paused` as the `isPaused` callback when calling `observeFiles`.
- Add the same yield-while-paused pattern in the scanning loop (line 149):

```typescript
for (const entry of imageEntries) {
  if (job.cancelled) { ... break; }
  while (job.paused && !job.cancelled) {
    await new Promise(r => setTimeout(r, 200));
  }
  if (job.cancelled) { ... break; }
  // ... upsert ...
}
```

**File: [semantic-search-handlers.ts](apps/desktop-media/electron/ipc/semantic-search-handlers.ts)**

- Import `pauseAllMetadataScans` and `resumeAllMetadataScans` from `./state`.
- Wrap the `semanticSearchPhotos` handler with pause/resume:

```typescript
ipcMain.handle(IPC_CHANNELS.semanticSearchPhotos, async (_event, request) => {
  pauseAllMetadataScans();
  try {
    // ... existing search logic (embedTextDirect + searchByVector) ...
  } finally {
    resumeAllMetadataScans();
  }
});
```

**File: [fs-handlers.ts](apps/desktop-media/electron/ipc/fs-handlers.ts)**

- Update the `new RunningMetadataScanJob` initialization to include `paused: false` (line 56 in metadata-scan-handlers.ts).

### C. Verify and test

- Run `pnpm run typecheck --filter @emk/desktop-media` and `pnpm --filter @emk/desktop-media run build:main` to verify compilation.
- Run existing E2E tests to confirm no regressions.
- Check lints on all modified files.

