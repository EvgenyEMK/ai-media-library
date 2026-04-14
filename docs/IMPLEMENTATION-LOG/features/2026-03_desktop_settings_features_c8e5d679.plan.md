---
name: Desktop Settings Features
overview: Add two persisted setting groups (folder auto-scan threshold and AI search similarity floor), gate automatic metadata scans after folder listing in the main process, filter semantic grid/viewer by score in the renderer, and enlarge Settings typography to match the People screen hero and shared settings controls.
todos:
  - id: ipc-storage-settings
    content: Add FolderScanningSettings + AiImageSearchSettings to ipc.ts, DEFAULT_APP_SETTINGS, storage sanitize/merge
    status: completed
  - id: slice-persistence-ui
    content: Extend desktop-slice, useDesktopInitialization + useDesktopSettingsPersistence, DesktopSettingsSection + App.tsx wiring
    status: completed
  - id: gate-fs-handlers
    content: In fs-handlers.ts, readSettings + conditional runMetadataScanJob after stream / listFolderImages only
    status: completed
  - id: semantic-filter
    content: "use-filtered-media-items: filter-derived semantic list + viewerItems; App grid + empty state"
    status: completed
  - id: typography
    content: settings-controls.tsx, DesktopSettingsSection inline text, Settings title, analysis-prompt-block CSS
    status: completed
isProject: false
---

# Desktop-media Settings: scanning threshold, AI similarity, typography

## Context (current behavior)

- **Settings UI** lives in `[DesktopSettingsSection.tsx](apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx)`; reusable controls in `[packages/media-viewer/src/settings-controls.tsx](packages/media-viewer/src/settings-controls.tsx)` (`SettingsSectionCard`, `SettingsNumberField` with `?` + `description`, numeric commit on blur/Enter).
- **Persistence**: `[src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts)` defines `AppSettings` + defaults; `[electron/storage.ts](apps/desktop-media/electron/storage.ts)` merges/sanitizes on read; `[useDesktopSettingsPersistence](apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts)` and startup in `useDesktopInitialization` mirror `faceDetection` / `photoAnalysis` today.
- **Auto metadata scan on folder pick**: `[runFolderImagesStream](apps/desktop-media/electron/ipc/fs-handlers.ts)` completes streaming, then always calls `runMetadataScanJob({ recursive: false, knownImageEntries })`. `[listFolderImages](apps/desktop-media/electron/ipc/fs-handlers.ts)` does the same. **Manual** “Scan tree for file changes” uses `scanFolderMetadata({ recursive: true })` elsewhere — **do not** gate that path.
- **Semantic scores**: IPC returns `score` per row; renderer stores `semanticResults` with `score` (`[App.tsx](apps/desktop-media/src/renderer/App.tsx)` ~~585–590). Viewer list for `"search"` is built from `semanticResults` in `[use-filtered-media-items.ts](apps/desktop-media/src/renderer/hooks/use-filtered-media-items.ts)` (~~68). Any filter must apply **to both** the thumbnail grid and `viewerItems` so indices stay aligned.

## 1. Folder scanning section

**Settings model** (mirror face detection: nested object + defaults + sanitization):

- Add to `[ipc.ts](apps/desktop-media/src/shared/ipc.ts)`: e.g. `FolderScanningSettings` with one field  
`autoMetadataScanOnSelectMaxFiles: number` (meaning: run automatic metadata/file scan **only** when the **non-recursive** image count is **strictly less than** this value).  
**Default: `100`** (scan if 0–99 images; skip at 100+).
- Extend `AppSettings` + `DEFAULT_APP_SETTINGS`.
- `[storage.ts](apps/desktop-media/electron/storage.ts)`: `sanitizeFolderScanningSettings` — clamp to sensible bounds (e.g. min `0`, max `1_000_000` or similar).

**Renderer store** `[desktop-slice.ts](apps/desktop-media/src/renderer/stores/desktop-slice.ts)`: `folderScanningSettings`, `updateFolderScanningSetting`, `resetFolderScanningSettings` (reset copies `DEFAULT_FOLDER_SCANNING_SETTINGS`).

**IPC bindings** `[useDesktopIpcBindings.ts](apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts)`: load into store in `useDesktopInitialization`; include all new fields in `useDesktopSettingsPersistence` subscription + `saveSettings` payload.

**UI** `[DesktopSettingsSection.tsx](apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx)`:

- Replace placeholder in “Folder scanning” with `SettingsNumberField`:
  - Title aligned to spec: *“Automatically scan folder for changes on selection if number of files less than”*
  - Subtitle note under the **section** (first line inside the card): *“Without sub-folders”* (`text-muted-foreground`, same scale as other helper text after typography pass).
  - `description` (?) explaining: avoids long (>30s) automatic scan on large **single-folder** listings; manual tree scan / other actions unchanged; count is images in the selected folder only.
  - **Reset to defaults** button with `disabled` when value equals default (same pattern as face detection).
- **Props**: extend component props + wire from `[App.tsx](apps/desktop-media/src/renderer/App.tsx)` like existing face/photo handlers.

**Main process** `[fs-handlers.ts](apps/desktop-media/electron/ipc/fs-handlers.ts)`:

- After building `knownImageEntries` / knowing `images.length` / `result.loaded`, `readSettings(app.getPath("userData"))` and compare:
  - **Stream path**: if `result.loaded >= settings.folderScanning.autoMetadataScanOnSelectMaxFiles` → **do not** call `runMetadataScanJob`.
  - `**listFolderImages`**: if `images.length >= threshold` → skip `runMetadataScanJob`.
- Keep the existing “cancel running metadata jobs” behavior when the stream **completes**, so switching folders still aborts stale work; only the **new** job start is conditional.

## 2. AI image search section

**Settings model**:

- Add `AiImageSearchSettings` e.g. `hideResultsBelowSimilarity: number`, **default `0.05`**, clamp in storage to `[0, 1]` (or `[0, 1)` if you want to exclude 1.0 edge cases — typically `[0, 1]` is fine).

Same wiring: `AppSettings`, defaults, `storage.ts`, `desktop-slice.ts`, init + persistence in `useDesktopIpcBindings.ts`, new section in `DesktopSettingsSection.tsx` with `SettingsNumberField`, `description` referencing cosine/similarity scores and the main-process log line `[semantic-search][main] summary:` for debugging, **Reset to defaults**.

**Functional filter** (renderer only; no IPC change):

- In `[use-filtered-media-items.ts](apps/desktop-media/src/renderer/hooks/use-filtered-media-items.ts)`:
  - Read `hideResultsBelowSimilarity` from the desktop store.
  - `useMemo`: `displaySemanticResults = semanticResults.filter((r) => r.score >= threshold)` (hide strictly below threshold; at threshold keep).
  - When `viewerSource === "search"`, build `viewerItems` from `displaySemanticResults` instead of `semanticResults`.
  - **Return** `displaySemanticResults` (or alias) for use in `App.tsx`.
- In `[App.tsx](apps/desktop-media/src/renderer/App.tsx)`:
  - Destructure filtered list from the hook.
  - **Grid**: map `displaySemanticResults` for `MediaThumbnailGrid`; `onItemClick` still `openViewer(index, "search")`.
  - `**semanticModeActive`**: keep based on **raw** `semanticResults.length > 0` so search mode stays on after a query.
  - **Empty state**: if raw results exist but filtered list is empty, show a short message under the grid area (e.g. all results below the configured similarity — adjust threshold in Settings). Avoid a blank main pane.

Optional polish: update `semanticStatus` after search to mention shown vs total (not required for MVP).

## 3. Typography — Settings and shared controls

**Goal**: Match the **People** list hero title scale (`[DesktopPeopleTagsListTab.tsx](apps/desktop-media/src/renderer/components/DesktopPeopleTagsListTab.tsx)` uses `text-3xl font-bold md:text-4xl` on the main heading). Settings currently uses `text-lg` for “Settings” in `DesktopSettingsSection` — **upgrade to the same hero classes** and use similar outer spacing (`mx-auto max-w-7xl`, `px/py`) as People if you want pixel parity (minimal change: at least the `h2`/title classes + padding).

`**[settings-only` components](packages/media-viewer/src/settings-controls.tsx)** (used **only** by desktop-media per repo grep):

- Increase default sizes: e.g. section `summary` from `text-sm` → `text-base`, field title `h4` `text-sm` → `text-base`, description `text-xs` → `text-sm`, number input `text-sm` → `text-base`, adjust input height if needed.

`**[DesktopSettingsSection.tsx](apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx)`** inline blocks (Image analysis checkboxes): bump `h4` / helper `p` / reset buttons to match the same step up as `SettingsNumberField`.

`**[styles.css](apps/desktop-media/src/renderer/styles.css)`** `.analysis-prompt-block` `summary` / `pre` font sizes (currently 12px / 11px) — increase slightly so prompt disclosure matches the rest of Settings.

## Files to touch (summary)


| Area                    | Files                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types & defaults        | `[apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts)`                                                                                                                                                 |
| Sanitize / read / write | `[apps/desktop-media/electron/storage.ts](apps/desktop-media/electron/storage.ts)`                                                                                                                                             |
| Gate auto scan          | `[apps/desktop-media/electron/ipc/fs-handlers.ts](apps/desktop-media/electron/ipc/fs-handlers.ts)`                                                                                                                             |
| Store                   | `[apps/desktop-media/src/renderer/stores/desktop-slice.ts](apps/desktop-media/src/renderer/stores/desktop-slice.ts)`                                                                                                           |
| Init + persist          | `[apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts](apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts)`                                                                                             |
| Filter + viewer         | `[apps/desktop-media/src/renderer/hooks/use-filtered-media-items.ts](apps/desktop-media/src/renderer/hooks/use-filtered-media-items.ts)`, `[apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx)` |
| Settings UI             | `[apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx](apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx)`                                                                               |
| Shared controls         | `[packages/media-viewer/src/settings-controls.tsx](packages/media-viewer/src/settings-controls.tsx)`                                                                                                                           |
| Prompt blocks           | `[apps/desktop-media/src/renderer/styles.css](apps/desktop-media/src/renderer/styles.css)`                                                                                                                                     |


No change to `[semantic-search-handlers.ts](apps/desktop-media/electron/ipc/semantic-search-handlers.ts)` spread-based cutoff unless you explicitly want settings-driven filtering in main; user asked to hide in results — client-side filter after IPC is sufficient and keeps behavior consistent when the user changes the threshold without re-running the query.