---
name: Improve Folder AI Summary View
overview: Update the Folder AI analysis summary table UI/labels and data semantics to show image totals, richer per-pipeline status rendering, and clearer direct-vs-recursive rows for the selected folder.
todos:
  - id: update-ipc-types
    content: Update FolderAiSummaryReport contract to include selected recursive + direct coverages
    status: completed
  - id: update-main-handler
    content: Adjust folder-ai-summary IPC handler to compute and return both selected-folder coverage variants
    status: completed
  - id: update-summary-table
    content: Refactor DesktopFolderAiSummaryView table structure, status rendering rules, and new rows/columns
    status: completed
  - id: update-ui-text
    content: Add/rename UI text keys for Images and selected-folder row labels
    status: completed
  - id: update-summary-styles
    content: Apply CSS hierarchy and status styling (headers, subfolders line, highlighted total row, status visuals)
    status: completed
isProject: false
---

# Improve Folder AI Summary View

## Scope

Implement the requested UI/UX updates for the desktop-media "Folder AI analysis summary" view, including:

- new `Images` column,
- status cell redesign for Done/Partial/Not done,
- selected-folder row split into recursive vs direct counts,
- stronger visual hierarchy for key labels and table headers.

## Files To Change

- [apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx](apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx)
- [apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts](apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts)
- [apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts)
- [apps/desktop-media/src/renderer/lib/ui-text.ts](apps/desktop-media/src/renderer/lib/ui-text.ts)
- [apps/desktop-media/src/renderer/styles.css](apps/desktop-media/src/renderer/styles.css)

## Planned Changes

1. **Extend summary report shape for two selected-folder coverages**
  - In [apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts), change `FolderAiSummaryReport` to include:
    - `selectedWithSubfolders` (recursive=true)
    - `selectedDirectOnly` (recursive=false)
    - keep `subfolders` as-is (each row recursive=true)
  - This removes current semantic mismatch where the UI label says direct images but IPC returns recursive counts.
2. **Fix IPC handler to return both recursive and direct selected-folder rows**
  - In [apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts](apps/desktop-media/electron/ipc/folder-ai-summary-handlers.ts):
    - compute both `getFolderAiCoverage({ folderPath: normalized, recursive: true })` and `recursive: false` for selected folder,
    - map these to the new report fields,
    - preserve subfolder row behavior (`recursive: true` for each immediate subfolder).
3. **Rebuild summary table rows/columns in renderer**
  - In [apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx]:
    - add `Images` column immediately after `Folder` using `coverage.totalImages`,
    - replace old `statusText + done/total` rendering with status-specific rendering:
      - **Done:** large green `Check` icon only,
      - **Partial:** `"{floor(done/total*100)}% ({done})"` where percent is visually larger and done-count is smaller,
      - **Not done / empty:** `" - "` only,
    - create small reusable render helper for each pipeline cell to keep logic consistent across face/photo/semantic columns,
    - render two top rows for selected folder:
      - `Total with sub-folders` (main/highlight row)
      - `This folder without sub-folders`.
4. **Text updates**
  - In [apps/desktop-media/src/renderer/lib/ui-text.ts](apps/desktop-media/src/renderer/lib/ui-text.ts):
    - rename current selected-folder label text to `Total with sub-folders`,
    - add new label key for `This folder without sub-folders`,
    - add new `Images` column label key.
5. **Visual hierarchy and Tailwind-token color alignment**
  - In [apps/desktop-media/src/renderer/styles.css](apps/desktop-media/src/renderer/styles.css):
    - increase contrast for table headers (`th`) and `Sub-folders` section line vs normal content text,
    - add a standout style for the `Total with sub-folders` row (larger type + subtle emphasized background),
    - style Done icon using theme success token (`hsl(var(--success))`),
    - style Partial percent as primary readable text and done-count as smaller muted text,
    - keep Not done as a simple hyphen with muted color.

## Icon Proposal For Review (Partial / Not done)

- **Partial:** `CircleDashed` or `LoaderCircle` (static, no spin) from `lucide-react`.
  - Reason: visually conveys in-progress/completion fraction without implying failure.
- **Not done:** `Minus` (or `CircleMinus` if stronger emphasis needed).
  - Reason: clean neutral absence marker aligned with requested `" - "` semantics.

I will implement with `Check` for Done and keep Partial/Not done icon elements easy to toggle in one helper so you can quickly compare in UI.
