# Find duplicate files — business logic (desktop-media)

## Scope

Rules implemented in the desktop app for **which catalog rows are scanned**, **how duplicates are detected**, **what is skipped**, **how jobs run**, and **how deletion updates the library**. For screen-level behavior see [FIND-DUPLICATE-FILES-UX.md](./FIND-DUPLICATE-FILES-UX.md).

---

## 1) Data sources

- Duplicate detection works against **catalog rows** in SQLite (`media_items`), scoped by **library id** and **folder path** (exact folder vs folder + descendants depending on `recursive`).
- Only rows with `deleted_at IS NULL` participate.
- Paths must be on disk where hashing is required: missing files are skipped for runtime hashing and counted in scan statistics.

---

## 2) Pipeline: `folder-duplicate-scan`

- **Pipeline id:** `folder-duplicate-scan`
- **Display name:** `Check duplicate files — <folderPath>`
- **Concurrency group:** `io` (aligned with other disk-heavy work).
- **Parameters:** `folderPath` (required, trimmed), `recursive` (boolean, default `true` if omitted).

### 2.1 Phases (conceptual)

1. **Load scoped rows** — Query all catalog items whose `source_path` equals the folder or matches the recursive `LIKE` pattern; filter again in code so non-recursive runs exclude child-folder paths.
2. **Resolve content hashes** — For rows without `content_hash`:
   - Skip files **larger than 128 MiB** (no full hash; counted as skipped / unresolved hash).
   - Skip if the file is **missing on disk**.
   - Otherwise compute a **strong hash** (same helper as broader file-identity; bounded read) and remember it for this run only; persist where the existing pipeline already does for catalog consistency.
3. **Strong-hash duplicate groups** — For each scoped row with a resolved hash, load **all** catalog rows (any path in the library, not only the scan folder) with the same `content_hash`, merge with runtime hashes from the current job, and treat the set as one duplicate **group** if it contains more than one path.
4. **Weak-metadata fallback** — Rows that still have **no** usable hash enter buckets keyed by **case-insensitive file name + byte size + file mtime (ms)**. Any bucket with **two or more** rows becomes a weak duplicate group. Each row in the bucket is emitted as a duplicate of the others with `duplicateMatchBasis: "weak-metadata"` in the payload.
5. **Output** — Sorted rows with duplicate entries; counters for skipped large files, missing-on-disk, and unresolved hash totals.

### 2.2 Cancellation

- The scan observes `AbortSignal` from the pipeline scheduler: work yields to the event loop between units of progress so **cancel** from Background operations stops hashing and enumeration promptly.

### 2.3 Result caching

- Completed scan payloads are stored keyed by **job id** so the renderer can retrieve the structured result after the pipeline finishes.

---

## 3) Renderer aggregation

- The UI builds **symmetric** folder drill-down rows (inside vs outside the selected folder tree), deduplicates display keys, and avoids double-counting the same duplicate edge when showing “within tree” sections (recent branch behavior).
- **Cancelled** scan jobs are ignored when attaching completion handlers so a superseded run does not overwrite a newer session.

---

## 4) Pipeline: `duplicate-marked-files-delete`

- **Pipeline id:** `duplicate-marked-files-delete`
- **Display name:** user-facing string includes the number of targets, e.g. `Delete duplicate files (N)`.
- **Parameters:**
  - `targets`: array of `{ mediaItemId, sourcePath }` (non-empty, max **10,000** entries; duplicates by id are deduped server-side).
  - `useTrash`: default `true`; when `false`, uses permanent `unlink` instead of OS trash.

### 4.1 Per-target algorithm

1. Resolve the live path for the catalog id and ensure it still matches the **expected** path from the UI (guards against stale selection).
2. Delete on disk: `shell.trashItem` vs `fs.unlink` per `useTrash`.
3. On success, **soft-delete** the media item in the database (user removed file reconciliation). Mismatches or missing rows are reported as failures without silent catalog corruption.

### 4.2 Cancellation

- Deletion loop respects the pipeline abort signal between targets.

---

## 5) Product implications

- **Exact duplicates** are defined by **shared content hash** when available; the UI can show duplicates whose paths lie **outside** the scanned folder because the hash index is library-wide.
- **Weak duplicates** are **heuristic** and should never be treated as cryptographic proof of identical content.
- **Large files** over the hash limit are not strongly compared; they may appear only if weak metadata matches, or not at all until hashing strategy evolves (see implementation log around file identity for long-term direction).

---

## 6) Related code (for maintainers)

| Area | Location |
| --- | --- |
| Scan implementation | `apps/desktop-media/electron/db/folder-duplicate-scan.ts` |
| Weak bucketing | `apps/desktop-media/electron/lib/folder-duplicate-scan-weak.ts` |
| Pipeline definitions | `apps/desktop-media/electron/pipelines/definitions/folder-duplicate-scan.ts`, `duplicate-marked-files-delete.ts` |
| Renderer actions | `apps/desktop-media/src/renderer/actions/duplicate-files-actions.ts` |
| IPC contracts | `apps/desktop-media/src/shared/ipc.ts` |
