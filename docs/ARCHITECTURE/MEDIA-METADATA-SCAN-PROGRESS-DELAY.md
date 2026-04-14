# Media Metadata Scan Progress Delay

## Context

In large folders, users observe that the `Media metadata scan` card appears several seconds after selecting a folder.
In small folders, the scan may complete quickly and mostly report `unchanged` records, making a full progress card feel noisy.

This note captures why this happens today and proposes improvements.

---

## Why The Delay Happens

Current folder-select flow performs multiple steps before the metadata scan card starts:

1. Folder selection triggers image streaming (`startFolderImagesStream`).
2. Main process streams file batches for the gallery UI.
3. Metadata scan is started only after stream completion path triggers it.
4. Metadata scan then enumerates images again and begins DB upsert/compare work.

Because the progress card is tied to metadata scan job events (`job-started`), users do not get immediate visual feedback for the earlier discovery/preparation phase.

---

## UX/Technical Consequences

- Perceived lag: users think nothing is happening for 5-10 seconds on large folders.
- Duplicate traversal cost: folder listing and metadata scan each walk the same file set.
- Over-reporting for no-op scans: quick scans with all `unchanged` results still surface a full card.

---

## Proposal (Not Implemented Yet)

### 1) Immediate pre-scan feedback

Show instant bottom-panel status when folder is selected:
- `Preparing metadata scan...`
- indeterminate progress (spinner or animated bar) until totals are known.

### 2) Earlier scan start

Start metadata scan earlier (or in parallel with stream), not only after full stream completion.

### 3) Reuse discovered file list

Pass the streamed/discovered file list into metadata scan to avoid a second full folder walk.

### 4) Smart visibility for no-op/fast scans

Only show full metadata scan card when one of the following is true:
- runtime exceeds threshold (e.g., 400-800ms), or
- first meaningful mutation occurs (`created`, `updated`, `failed` > 0).

If scan completes very fast and results are all `unchanged`, suppress card visibility and keep experience quiet.

### 5) Optional completion toast

For suppressed no-op scans, optionally show a lightweight transient confirmation:
- `Metadata up to date`

---

## Success Criteria

- Users see immediate feedback from folder selection.
- Large-folder lag is replaced by explicit "preparing" state.
- No-op scans avoid unnecessary progress-card noise.
- End-to-end folder work performs fewer redundant file traversals.
