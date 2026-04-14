# App Settings (desktop-media)

## Scope

This document describes **product UX** and **business logic** for the **Settings** screen in **`apps/desktop-media`** (Electron). Settings apply to the local library, SQLite catalog, and on-device pipelines (face detection, embeddings, clustering, photo analysis, AI search).

Shared UI building blocks (`SettingsSectionCard`, `SettingsNumberField`) live in `@emk/media-viewer`; persistence and defaults are defined in app code (`src/shared/ipc.ts`, `electron/storage.ts`). A future **web-media** settings page may reuse the same components; behavior described here is authoritative for **desktop** unless noted otherwise.

Related UX docs:

- [File star rating](./FILE-STAR-RATING.md) — catalog values, grid/list/viewer UX, embedded writes.
- [AI image search (desktop)](../AI/AI-SEARCH-DESKTOP.md) — thresholds under **AI image search**.
- [Face detection](../AI/FACE-DETECTION-UX.md) — folder jobs using detection parameters.
- [People & face tags](../AI/PEOPLE-FACE-TAGS.md) — Untagged faces, **Find groups**, person suggestions.
- [Windows installer UX](../installer/WINDOWS-INSTALLER-UX.md) — install-time DB folder selection flow.
- [Windows installer business logic](../installer/WINDOWS-INSTALLER-BUSINESS-LOGIC.md) — path resolution order and persistence.

---

## 1) Opening Settings and layout

- **Settings** is a bottom item in the left sidebar (`MainAppSidebar` pattern).
- Choosing **Settings** replaces the main panel content with the settings page (no folder grid).
- The main panel uses a **scrollable content region** (`main-content`: `flex: 1`, `min-height: 0`, `overflow: auto`) so long pages and **expanded** sections remain reachable on smaller windows.
- Section cards are **`<details>`-based**: each block can be expanded or collapsed independently.
- **Default**: all sections start **collapsed** when the user opens Settings.

---

## 2) Settings page structure (sections)

Order on screen:

1. **File metadata management** (auto scan threshold + optional embedded writes on user edits)
2. **Application data files** (read-only visibility of database/models/cache paths)
3. **AI image search**
4. **Face detection**
5. **Face recognition**
6. **Image analysis** (photo / vision analysis defaults and toggles)

Each section ends with a **Reset to defaults** action (same user-visible label in every section for easy translation). Reset **only affects that section’s fields**, not the whole app.

---

## 3) File metadata management

This section is titled **File metadata management** in the app (types still use `FolderScanningSettings` in code). It combines **catalog refresh policy on folder open** with **optional writes back into image files** when the user edits certain fields.

### 3a) Automatic scan on folder selection

**Control**

- **Automatically scan folder for changes on selection if number of files less than** — integer ≥ 0 (upper bound enforced in storage).

**Behavior**

- If the **direct** image count in the opened folder (not subfolders) is **≥** this value, the automatic metadata / catalog pass on folder selection is **skipped**; thumbnails still load.
- Users can still run **Scan for file changes** from the folder menu (with or without subfolders).

**Copy pattern**

- Long descriptions use a **Why** / **How** split (line breaks) toggled via the **`?`** control next to each numeric field title.

### 3b) Update file metadata on change of Rating, Title, Description

**Control**

- **Checkbox** — `writeEmbeddedMetadataOnUserEdit` (default **off**).

**Behavior**

- **When off (default):** Star rating (and future title/description editors) update the **SQLite catalog** only. Original files on disk are not modified for those actions.
- **When on:** After the catalog update succeeds, the main process runs **ExifTool** to write **XMP** and **Windows-friendly EXIF** for **rating** (and will apply to **title** / **description** when those in-app writers ship). The file write is **asynchronous** so the UI updates immediately; failures are logged and do **not** roll back the catalog value.

**Product intent**

- Users who share folders with **Explorer**, **Lightroom**, or other XMP-aware tools can keep embedded tags aligned with the app.
- Users who want a **non-destructive** workflow leave the checkbox **off**.

**Related**

- UX and normalization rules: [FILE-STAR-RATING.md](./FILE-STAR-RATING.md).
- Business rules: [DESKTOP-MEDIA-STAR-RATING.md](./DESKTOP-MEDIA-STAR-RATING.md).

---

## 4) AI image search

Section order in the UI:

1. Intro paragraph (two retrieval methods, RRF, English prompt / translation).
2. **VLM (visual) similarity threshold** — `0..1`, cosine floor for **grid visibility** (query vs image embedding): hide a row only when **both** VLM and description signals are **strictly below** their respective floors (**OR** gate across the two sliders below).
3. **AI description similarity threshold** — `0..1`, same **visibility** gate for the AI title+description text embedding.
4. **Advanced search — Translate search prompt to English if needed** — **informational only** (checkbox always on, disabled). Documents that enabling **Advanced search** in the search panel uses the LLM’s English/normalized query for embedding when available.
5. **Advanced search — Keyword match reranking** — default **off**. When on, the app may **re-order** results after RRF using LLM keywords (see [AI-SEARCH-DESKTOP.md](../AI/AI-SEARCH-DESKTOP.md) §2.3.1). When off, keyword thresholds are **grayed out** and have no effect.
6. **Advanced search — Keyword match threshold — VLM** — `0..1`, default **0.05**. Used **only when keyword match reranking is on**: minimum cosine between each **keyword** embedding and the image **VLM** embedding for a hit. **0** = VLM does not count toward keyword hits.
7. **Advanced search — Keyword match threshold — AI Description** — `0..1`, default **0.5**. Same, for the **AI description** embedding. If **both** keyword thresholds are **0**, re-ranking is skipped.
8. **Show matching method selector in search filters** — default **off**. When on, the AI image search panel shows **Matching method** (hybrid / VLM only / description only).

**Behavior**

- **Visibility** (what thumbnails remain): driven by the first two numeric fields only—**OR** across VLM and description (see [AI-SEARCH-DESKTOP.md](../AI/AI-SEARCH-DESKTOP.md)).
- **Keyword re-ranking**: independent absolute thresholds; controlled by the **Keyword match reranking** checkbox.

**Intro text**

- On-screen copy explains dual-signal ranking and RRF; per-field **Why / How** are toggled via **`?`** next to each control.

---

## 4b) Application data files (read-only)

**Purpose**

- Make the active database folder and resolved file path visible to the user.
- Improve supportability when users install with non-default data paths.

**Controls**

- Read-only values:
  - Database folder (`userDataPath`)
  - Database file (`desktop-media.db`)
  - Resolved path (`<userDataPath>/desktop-media.db`)
  - AI models folder (outside backup root; cache-root namespace)
  - Disposable cache folder

**Behavior**

- Values are loaded from main process via IPC (`getDatabaseLocation`).
- This section is informational only in the current phase (no in-app path switch).

---

## 5) AI image search

These parameters affect **RetinaFace-style detection** and post-filters when running face detection (folder jobs, per-image flows). They do **not** define identity matching or untagged grouping.

**Controls** (each `0..1`)

| Setting | Role (summary) |
|--------|-----------------|
| **Minimum confidence threshold** | Drop low-confidence boxes (false positives). |
| **Minimum face box short-side ratio** | Ignore faces that are too small in the frame. |
| **Face box overlap merge ratio** | Merge overlapping boxes that likely depict one face. |

**Defaults** (source: `DEFAULT_FACE_DETECTION_SETTINGS` in `ipc.ts`)

- `minConfidenceThreshold = 0.75`
- `minFaceBoxShortSideRatio = 0.05`
- `faceBoxOverlapMergeRatio = 0.5`

**Reset**

- **Reset to defaults** restores **only** the three fields above.

---

## 7) Face recognition

This section separates **who is this person?** matching from **raw detection**. Values are stored in the same persisted object as face detection (`faceDetection` in settings JSON) but are edited here for clarity.

**Controls**

| Setting | Role (summary) |
|--------|-----------------|
| **Similarity threshold for suggesting a person** | Minimum cosine similarity between an **untagged** face embedding and a **named person’s centroid** for suggestions (e.g. similar-face hints, unconfirmed rows). Typical range `0..1`; lower = more suggestions, higher = stricter. |
| **How similar two faces must look to join the same group** | Minimum **pairwise** cosine similarity used when building **draft groups** of untagged faces (graph link threshold). Higher values yield smaller, tighter groups; lower values allow larger chains of “looks alike” links. |
| **Minimum faces in a suggested group** | Integer (stored clamped, e.g. **2–500**). After grouping, clusters with fewer than this many faces are **discarded**; those faces remain ungrouped until the next **Find groups** run. |

**Defaults**

- `faceRecognitionSimilarityThreshold = 0.38`
- `faceGroupPairwiseSimilarityThreshold = 0.55`
- `faceGroupMinSize = 4`

**Where grouping runs**

- **People → Untagged faces → Find groups** invokes clustering with the **pairwise similarity** and **minimum faces per group** from this section (see `runFaceClustering` / `runClusterUntaggedFacesJob`).

**Reset**

- **Reset to defaults** restores **only** the three recognition fields above (detection section unchanged).

---

## 8) Image analysis

**Controls**

- **AI model** — default vision model for folder **Image AI** runs from menus.
- **Analysis timed out per image (seconds)** — per-image timeout for batch analysis.
- **Checkboxes** (larger than native default for accessibility; themed accent):
  - Two-pass analysis for rotated images
  - Use face features to detect photo rotation
  - Extract invoice data (second prompt when category matches)

**Prompt disclosure**

- Collapsible **details** blocks show shipped prompt text and version notes for analysis and invoice extraction.

**Reset**

- **Reset to defaults** restores model, timeout, and all three booleans to product defaults.

---

## 9) Field UX conventions

- **Numeric rows**: title, **`?`** to show/hide description, inline number input, allowed range hint.
- Descriptions should separate **Why** (intent) and **How** (mechanism) with a clear line break when both apply.
- **Validation**: out-of-range values are not committed silently (field shows an error; blur/Enter commits valid numbers).

---

## 10) Persistence and application

- Settings file: **`media-settings.json`** under the app **userData** directory (see `electron/storage.ts`).
- `userData` path can be overridden by installer-selected path persisted under `%APPDATA%\EMK Desktop Media\install-user-data-path.txt` (see installer docs).
- On startup, missing or invalid keys are **sanitized** and clamped to safe ranges; defaults fill new fields for older files.
- Renderer state is synced with the main process; changes trigger **save** (debounced subscription in `useDesktopSettingsPersistence`).
- **Face detection** fields are passed into detection IPC (folder and single-image).
- **Face recognition** similarity drives suggestion and similar-face logic; **grouping** parameters drive **Find groups** only.
- **Photo analysis** fields are passed into analysis jobs.
- **AI image search** thresholds are read by the renderer search panel and related logic.
- **File metadata management** (`FolderScanningSettings`) drives auto-scan thresholds and **`writeEmbeddedMetadataOnUserEdit`** for optional embedded rating (and future title/description) writes.

---

## 11) Implementation references (engineering)

| Concern | Location (indicative) |
|--------|------------------------|
| Types & defaults | `apps/desktop-media/src/shared/ipc.ts` |
| Read/write + sanitize | `apps/desktop-media/electron/storage.ts` |
| Install path resolution | `apps/desktop-media/electron/install-config.ts` |
| Settings UI composition | `apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx` |
| Scroll shell | `App.tsx` — `main-content` wrapper when Settings (or People) is active |
| Shared section/field UI | `packages/media-viewer/src/settings-controls.tsx` |

---

## 12) Future / web-media

- Reuse shared settings components where possible; **persistence** on web will differ (account/server).
- Keep **one user-visible string** for per-section reset (**Reset to defaults**) so locales can map a single key.
