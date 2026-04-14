---
name: Face Detection UX Improvements
overview: Redesign the face detection menu in the desktop app to use Play/Pause buttons with checkboxes for options, and add subfolder scanning support with folder-aware progress display.
todos:
  - id: menu-ui
    content: "Redesign face detection submenu: Play/Pause button + Include sub-folders checkbox + Override existing checkbox"
    status: completed
  - id: ipc-types
    content: Add `recursive` to DetectFolderFacesRequest and `currentFolderPath` to progress events in ipc.ts
    status: completed
  - id: main-process
    content: Implement recursive subfolder scanning in detectFolderFaces handler and runFaceDetectionJob in main.ts
    status: completed
  - id: renderer-handler
    content: Update handleDetectFaces to pass recursive and override options from checkboxes
    status: completed
  - id: store-slice
    content: Add faceCurrentFolderPath to face-detection store slice
    status: completed
  - id: ipc-bindings
    content: Update bindFaceDetectionProgress to track currentFolderPath from events
    status: completed
  - id: progress-panel
    content: Show current folder name in progress panel title
    status: completed
  - id: css-styles
    content: Add spinner animation and checkbox styling in styles.css
    status: completed
isProject: false
---

# Face Detection UX Improvements

## Scope

This plan focuses on the **desktop-media** app (Electron). The changes span the actions menu UI, the IPC layer, the main process handler, and the progress panel.

---

## 1. Redesign the "Face detection" submenu (Menu UI)

**File:** [apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx) (lines ~1040-1073)

Current submenu has two buttons: "Only if missing" and "All photos". Replace with:

- **"Face detection" line**: Add a Play icon-button inline (to the right). When `isDetectingFaces`, change to a Pause icon with a CSS spinner animation.
  - Clicking Play starts detection with current checkbox options.
  - Clicking Pause cancels the current job.
- **Checkbox "Include sub-folders"**: Below the "Face detection" label, inside `desktop-actions-submenu`. Checked by default. Stored as local state: `faceIncludeSubfolders`.
- **Checkbox "Override existing"**: Below "Include sub-folders". Unchecked by default. Stored as local state: `faceOverrideExisting`.
  - Unchecked = `mode: "missing"` (skip already-detected), Checked = `mode: "all"`.

**Lucide icons needed:** Add `Play`, `Pause`, `Loader` (or use CSS `@keyframes spin` on the Pause icon) to the import from `lucide-react`.

**New local state** (add near line 437):

```ts
const [faceIncludeSubfolders, setFaceIncludeSubfolders] = useState(true);
const [faceOverrideExisting, setFaceOverrideExisting] = useState(false);
```

**Updated menu JSX** (replace lines ~1041-1073):

```
Face detection [Play/Pause button]
  submenu:
    [x] Include sub-folders
    [ ] Override existing
```

The Play button calls `handleDetectFaces(faceOverrideExisting ? "all" : "missing")` passing the new `recursive` option. The menu stays open so the user can toggle checkboxes. Only the Play/Pause button triggers actions.

**CSS** ([apps/desktop-media/src/renderer/styles.css](apps/desktop-media/src/renderer/styles.css)):

- Add `.face-detect-play-btn` for inline icon button styling.
- Add `@keyframes spin` and `.spinning` class for the spinner animation on the Pause icon.
- Style the checkbox rows similar to existing `.analysis-option-row` but with `input[type="checkbox"]` having `min-width: auto`.

---

## 2. Add subfolder support to `DetectFolderFacesRequest` (IPC types)

**File:** [apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts) (line ~302)

Add `recursive?: boolean` to `DetectFolderFacesRequest`:

```ts
export interface DetectFolderFacesRequest {
  folderPath: string;
  mode?: "missing" | "all";
  recursive?: boolean;  // NEW
  concurrency?: number;
  faceDetectionSettings?: FaceDetectionSettings;
}
```

Add `currentFolderPath?: string` to the `job-started` and `item-updated` events so the renderer knows which folder is currently being processed:

```ts
// In job-started event:
currentFolderPath?: string;
// In item-updated event:
currentFolderPath?: string;
```

---

## 3. Add subfolder processing in the main process handler

**File:** [apps/desktop-media/electron/main.ts](apps/desktop-media/electron/main.ts) (lines ~320-400)

Modify the `detectFolderFaces` IPC handler:

- If `request.recursive` is true, use existing `collectFoldersRecursively(folderPath)` to get all folders, then `collectImageEntriesForFolders(folders)` (or similar) to list all images across all subfolders.
- The "missing" mode filter (`getAlreadyFaceDetectedPhotoPaths`) needs to work per-folder. Collect images per folder, filter out already-detected per folder, then merge into a single flat list with `folderPath` tag on each entry.
- The `runFaceDetectionJob` function (lines ~1425-1583) needs a `folderPath` field per photo so the progress events can include which folder each photo belongs to. Extend the `photos` parameter from `Array<{ path: string; name: string }>` to `Array<{ path: string; name: string; folderPath: string }>`.
- Emit `currentFolderPath` in `item-updated` events so the UI can display it.

**Key changes to `runFaceDetectionJob`:**

- Pass `folderPath` per photo entry.
- In `upsertDetectedFacePhoto`, use the photo's `folderPath` instead of the job-level folder path.
- Include `currentFolderPath: photo.folderPath` in each `item-updated` event.

---

## 4. Update `handleDetectFaces` in the renderer

**File:** [apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx) (lines ~771-800)

Pass `recursive: faceIncludeSubfolders` in the call to `detectFolderFaces`:

```ts
const result = await window.desktopApi.detectFolderFaces({
  folderPath: selectedFolder,
  mode: faceOverrideExisting ? "all" : "missing",
  recursive: faceIncludeSubfolders,
  concurrency: 2,
  faceDetectionSettings,
});
```

---

## 5. Update the progress panel to show current folder name

**File:** [apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx) (lines ~1448-1486)

- Track `faceCurrentFolderPath` in the store (or derive from `item-updated` events).
- Change the panel title from static `"Local face detection"` to dynamic: `"Local face detection - <folder name>"` where folder name is `path.basename(faceCurrentFolderPath)` (extract just the folder name, not the full path).
- The progress bar remains based on total progress (all files across all subfolders), which is already correct since `faceTotal` = `faceItemOrder.length` counts all items.

**Store changes** ([packages/media-store/src/slices/face-detection.ts](packages/media-store/src/slices/face-detection.ts)):

- Add `faceCurrentFolderPath: string | null` to `FaceDetectionSlice`.
- Add `setFaceCurrentFolderPath` action.

**IPC bindings** ([apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts](apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts)):

- On `item-updated`, if `event.currentFolderPath` is present, update `faceCurrentFolderPath` in store.

---

## 6. Verify "skip already-detected" logic

The current "missing" mode logic (lines 342-353 of `main.ts`) already correctly:

1. Checks in-memory cache (`detectedFacesByFolder`)
2. Checks DB via `getAlreadyFaceDetectedPhotoPaths` (queries `media_face_instances` join `media_items`)
3. Filters out photos that exist in either set

The DB query checks for rows in `media_face_instances` for the given `source_path`, which correctly identifies photos with detected faces. This is sound.

For subfolder support, the same filtering will be applied per-folder in the new recursive handler, so it will continue to work correctly.

---

## Files to modify (summary)


| File                                                             | Change                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/desktop-media/src/shared/ipc.ts`                           | Add `recursive` to request, `currentFolderPath` to events                       |
| `apps/desktop-media/electron/main.ts`                            | Recursive folder collection in `detectFolderFaces`, pass `folderPath` per photo |
| `apps/desktop-media/src/renderer/App.tsx`                        | Redesign menu, add checkboxes, pass `recursive`, show folder name in panel      |
| `apps/desktop-media/src/renderer/styles.css`                     | Spinner animation, checkbox styling                                             |
| `packages/media-store/src/slices/face-detection.ts`              | Add `faceCurrentFolderPath` state                                               |
| `apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts` | Track current folder from events                                                |


