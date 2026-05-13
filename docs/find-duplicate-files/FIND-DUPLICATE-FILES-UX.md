# Find duplicate files — UX (desktop-media)

## Scope

End-user experience for discovering duplicate media files in the catalog, reviewing them in a dedicated workspace, and optionally removing marked copies. Applies to the Electron desktop app (`apps/desktop-media`).

---

## 1) Entry points

### 1.1 Sidebar — Insights

- The left sidebar includes an **Insights** section with two sub-items:
  - **Duplicate files** — starts or resumes the duplicate-files flow from the library scope described below.
  - **Folder analysis status** — opens the existing folder-analysis summary flow (separate feature; see [FOLDER-ANALYTICS-MENU-UX.md](../PRODUCT-FEATURES/media-library/FOLDER-ANALYTICS-MENU-UX.md)).

- Choosing **Duplicate files** expands **Insights** (and expands the sidebar if it was collapsed) so the user stays oriented in navigation.

#### Library selection (multiple roots)

- If the library has **more than one** configured root folder, the app shows a **library pick hub**: a grid of cards (folder icon, short name, full path). The user picks which root to scan.
- If there is **exactly one** root, that root is chosen automatically and the duplicate scan is enqueued without the pick hub.

#### Empty libraries

- With **no** library folders added, the hub shows guidance to add folders and run a full scan first (catalog must contain items to compare).

### 1.2 Sidebar — folder row context menu

- On each folder row in the tree, the context menu (ellipsis or right-click) includes **Check duplicate files**.
- The row uses the same accordion pattern as **Scan for file changes**: expand the row to reveal **Include sub-folders** (default on). A run control starts the check for **that folder row’s path** and the chosen recursion flag.
- This is the primary way to run a duplicate check for a **specific** subtree without going through Insights.

### 1.3 Toolbar “More actions” menu

- The top-right folder **More actions** menu does **not** duplicate this control today; duplicate checks are initiated from **Insights** or the **sidebar folder** menu only.

---

## 2) Background operations

- **Check duplicate files** runs as a pipeline job named like `Check duplicate files — <folder path>` in **Background operations** (bottom panel).
- When a duplicate scan starts, if the background panel was **collapsed**, the app **expands** it so the user sees progress immediately.
- The user can **cancel** the scan from the pipeline card; cancellation is supported cooperatively during hashing and duplicate evaluation.

---

## 3) Main workspace — after scan

### 3.1 Scanning phase

- While the pipeline is still running, the main pane can show a lightweight **scanning** shell for the chosen folder (path + recursive flag) until results are ready.

### 3.2 Results workspace

- When results arrive, the main pane switches to the **duplicate files workspace**:
  - **Pagination** for long result sets.
  - Results are grouped into sections such as **Duplicates within selected folder tree** / **Duplicates outside selected folder tree** (wording adapts to whether the selection is a flat folder or a tree scope).
  - Each logical duplicate is shown as a **row**: the **catalog item in scope** (“scoped” side) and one or more **other catalog paths** that match (“duplicate” side), with thumbnails where applicable, size, and date line.
  - If the scoped file name differs from the duplicate’s file name, a **Different file name** hint appears on the duplicate side.

### 3.3 Weak matches (amber note)

- Rows detected only via **file name + byte size + modification time** (no reliable content hash) show an amber note: duplicate is based on metadata only; the user should treat these as **probable** duplicates.

### 3.4 Marking and deletion

- Each side of a pair has a **mark for delete** control. The user marks the copies they want removed.
- **Delete** is offered **per column** (scoped column vs duplicate column) via a trash action, and only applies to **marked** rows in that column.
- A confirmation dialog asks **Delete files?**, shows counts (files and folders affected), total size, and a checkbox **Move deleted files to Recycle Bin or Trash** (default on). If unchecked, files are **permanently** deleted from disk.
- During deletion, a separate pipeline (**Delete duplicate files**) runs in Background operations. The UI disables conflicting actions while deletion is in progress.
- After successful removal, catalog rows are reconciled (soft delete for removed files); the workspace updates to reflect removed items.

### 3.5 Closing the flow

- The user can leave the workspace (back/close control) to return to normal media browsing. Opening **Duplicate files** from Insights again follows the same library-root rules.

---

## 4) Interaction with other flows

- **Similar images** and **duplicate files** both use the main workspace area; the app treats them as mutually exclusive views (opening one closes the other when relevant).
- **Folder AI analysis summary** opened from Insights is coordinated so navigation state stays consistent when switching between Insights sub-sections.

---

## 5) Related product docs

- [FIND-DUPLICATE-FILES-BUSINESS-LOGIC.md](./FIND-DUPLICATE-FILES-BUSINESS-LOGIC.md) — technical matching and pipeline behavior.
- [FOLDER-ANALYTICS-MENU-UX.md](../PRODUCT-FEATURES/media-library/FOLDER-ANALYTICS-MENU-UX.md) — folder AI / scan menus (not duplicate-specific).
