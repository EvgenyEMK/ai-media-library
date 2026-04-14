---
name: Fix metadata scan progress bar
overview: Fix the metadata scan progress bar not showing during auto-triggered scans on folder selection. The root cause is a combination of the scan completing too fast for unchanged files and the auto-hide logic relying on a React ref that misses state transitions due to React 18 batching.
todos:
  - id: move-autohide-to-ipc
    content: Move auto-hide logic from React useEffect in App.tsx to the bindMetadataScanProgress IPC handler in useDesktopIpcBindings.ts, with a ~2s delay timer and state guards
    status: completed
  - id: cleanup-app-tsx
    content: Remove previousMetadataStatusRef and the auto-hide useEffect from App.tsx; add effect to reset progressPanelCollapsed when metadataPanelVisible becomes true
    status: completed
isProject: false
---

# Fix Metadata Scan Progress Bar Visibility

## Root Cause Analysis

When a folder is selected, the flow is:

1. `handleSelectFolder` in [App.tsx](apps/desktop-media/src/renderer/App.tsx) calls `startFolderImagesStream`
2. After images finish loading, the main process auto-triggers a metadata scan in `runFolderImagesStream` ([main.ts](apps/desktop-media/electron/main.ts), line 1359):

```ts
   void runMetadataScanJob({ folderPath, recursive: false }).catch(() => undefined);
   

```

1. `runMetadataScanJob` emits `job-started` (sets `metadataPanelVisible = true`, `metadataStatus = "running"`)
2. For unchanged files, `upsertMediaItemFromFilePath` ([media-item-metadata.ts](apps/desktop-media/electron/db/media-item-metadata.ts), lines 118-125) is a synchronous SQLite lookup that returns instantly
3. The entire scan completes in single-digit milliseconds for folders with unchanged files
4. `job-completed` is emitted immediately after

**Two issues prevent the user from seeing the progress bar:**

### Issue 1: React 18 automatic batching

When the scan completes in < 16ms, React 18 batches the `job-started` (status = "running") and `job-completed` (status = "completed") state updates into a single render. The component never renders with status "running". The auto-hide effect uses `previousMetadataStatusRef` which is only updated during React effects (post-render), so it never captures "running". The auto-hide condition `previousStatus === "running"` fails, and the panel either stays visible indefinitely in "completed" state or flashes imperceptibly.

### Issue 2: Immediate auto-hide timing

Even when events are NOT batched (scan takes slightly longer), the panel appears for just 1-3 frames (~16-50ms) in "running" state, then immediately auto-hides when the effect fires on the "completed" render. This is imperceptible to the user.

The auto-hide effect in [App.tsx](apps/desktop-media/src/renderer/App.tsx) (lines 866-879):

```ts
useEffect(() => {
    const previousStatus = previousMetadataStatusRef.current;
    previousMetadataStatusRef.current = metadataStatus;
    if (previousStatus !== "running" || metadataStatus !== "completed" || !metadataSummary) {
      return;
    }
    if (metadataSummary.created === 0 && metadataSummary.updated === 0) {
      store.getState().setMetadataPanelVisible(false);
    }
  }, [metadataStatus, metadataSummary, store]);
```

---

## Fix

### Move auto-hide logic from React effect to the IPC handler

The core fix is to move the auto-hide logic out of a React `useEffect` (which depends on rendered state and is subject to batching) into the `bindMetadataScanProgress` IPC handler in [useDesktopIpcBindings.ts](apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts), where Zustand state transitions are synchronous and always captured.

**Key changes:**

- In the `job-completed` handler inside `bindMetadataScanProgress`, read `store.getState().metadataStatus` **before** updating it to detect the "running" to "completed" transition reliably
- When no changes detected (`created === 0 && updated === 0`), schedule the auto-hide with a `setTimeout` of ~2 seconds (`AUTO_HIDE_DELAY_MS`), giving the user time to see the completed state
- The timeout callback re-checks current state to avoid hiding if a new scan started or the user interacted with the panel
- Track the timeout ID so it can be cleared on cleanup or when a new scan starts

### Remove the React effect and ref

- Remove `previousMetadataStatusRef` (line 616) and the auto-hide `useEffect` (lines 866-879) from [App.tsx](apps/desktop-media/src/renderer/App.tsx)

### Ensure progress panel is not collapsed

- Add a small effect in App.tsx that resets `progressPanelCollapsed` to `false` whenever `metadataPanelVisible` transitions to `true`, so the auto-triggered scan's progress dock is always expanded

---

## Files to Change

- [apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts](apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts) -- add delayed auto-hide logic in `bindMetadataScanProgress` `job-completed` handler; clear timer on `job-started` and on cleanup
- [apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx) -- remove the auto-hide `useEffect` and `previousMetadataStatusRef`; add effect to reset `progressPanelCollapsed` when `metadataPanelVisible` becomes `true`

