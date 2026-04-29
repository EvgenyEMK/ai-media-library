# Pipeline orchestration — follow-up work

Tracks open work that depends on the orchestration foundation
introduced in commit `feat(desktop-media): introduce pipeline
orchestration foundation` (`apps/desktop-media/electron/pipelines/**`).

## 1. Face detection performance regression (high priority)

### Symptoms

- Face detection on images that **contain faces** is 5–15 s/file vs.
  the previously observed 1–2 s/file.
- Images **without faces** finish quickly. The slowdown is correlated
  with `result.faceCount > 0`.
- Reproduces on a freshly initialised catalog (empty SQLite DB).
- Reproduces in stand-alone face detection (no other pipelines running
  in parallel).
- Reproduces with rotation pre-check disabled and with aux models
  (age/gender, landmark refiner) disabled.
- Not the warmup-on-first-N-items effect — the slowdown affects every
  face-bearing image throughout the run.

### Reproduction folder

```
C:\EMK-Media\2022
├── 2022 Geneva appartment   13 images, no faces      → fast
└── 2022 Skiing               first 7 images w/ faces → 5-15 s/file
```

Trigger via folder right-click → **Detect faces** with **Override
existing** enabled.

### Suspected cause

`runFaceDetectionJob` (`apps/desktop-media/electron/ipc/face-detection-handlers.ts:881-1030`)
runs a fixed sequence per image:

1. `ensureMetadataForImage(photo.path)` — exiftool, only on first touch
2. `runWrongImageRotationPrecheck(...)` — early-returns when disabled
3. `detectFacesUsingOrientationState(...)` — YOLO12/RetinaFace inference
4. `upsertFaceDetectionResult(...)` — DB write
5. **`autoChainEmbeddings(mediaId, photo.path, result, signal, …)`** —
   only runs when `result.faceCount > 0`

Step 5 is the only step gated on `faceCount > 0`. The arcface embedding
model runs **once per detected face** and writes `face_embeddings`
rows. With 1–5 faces per image and ONNX inference latency on the
shared iGPU + native postprocessing, 5–15 s aligns with this hypothesis.

This is independent of the orchestration branch — face-detection code
was not modified — but the issue should be addressed before face
detection is wrapped as a real `PipelineDefinition`, otherwise the
orchestration UX will inherit the perf regression.

### Investigation plan

1. Add a one-line per-item log inside `runWorker` after step 5
   completes, reporting `elapsed_total`, `faceCount`, and a per-step
   breakdown:

   ```typescript
   console.log(
     `[face-perf] ${photo.path} total=${total.toFixed(2)}s ` +
       `meta=${metaSec.toFixed(2)} rot=${rotSec.toFixed(2)} ` +
       `detect=${detectSec.toFixed(2)} embed=${embedSec.toFixed(2)} ` +
       `faces=${result.faceCount}`,
   );
   ```

2. Run the reproduction folder with override-existing enabled and
   capture the log.
3. If `embed` dominates: profile arcface inference. Check whether the
   recent face-aux-models / GPU-fallback / multi-model commits
   (commits `e612393`, `b4f2d20`, `be51912`, `12b4294`, `78812dc`)
   regressed embedding throughput. Specifically:
   - Did arcface switch ONNX execution providers (CUDA/DML → CPU)?
   - Did batch size for embedding inference change?
   - Did orientation handling add an extra rotation pass per face?
4. If `detect` dominates: check the YOLO12+RetinaFace dual-model
   pipeline; previously a single detector ran. Two sequential
   detectors per image would explain a 2× slowdown but not 5×.
5. If something else dominates (DB, exiftool, JS postprocessing):
   capture a CPU profile via `--inspect-brk` and Chrome DevTools.

### Done criteria

- Median face-bearing-image detection latency back to ≤2.5 s on the
  reproduction folder.
- `[face-perf]` log committed (gated behind a debug flag) so future
  regressions are easy to spot.
- New unit test covering whichever code path was the bottleneck.

---

## 2. Phase 7 cleanup pre-requisites

The plan's Phase 7 ("delete legacy IPC channels, `runningXxxJobs`
maps, `bind*Progress` files, `getActiveJobStatuses`") cannot be done
until each remaining stub `PipelineDefinition` has a real
implementation. Today only 3 of 11 are real:

| Pipeline id | Status | Legacy IPC channel still in use |
|---|---|---|
| `geocoder-init` | real ✅ | `geocoder:init` (also still used) |
| `gps-geocode` | real ✅ | inline call inside `metadata-scan` (legacy) |
| `path-rule-extraction` | real ✅ | inline call inside `metadata-scan` (legacy) |
| `metadata-scan` | real ✅ | `media:scan-folder-metadata` (still legacy-triggered UI path) |
| `image-rotation-precheck` | real ✅ | inline in face / photo-analysis / semantic handlers (facade migration pending) |
| `face-detection` | real ✅ | `media:detect-folder-faces` (legacy trigger path still active) |
| `face-embedding` | real ✅ | inline `autoChainEmbeddings` + `media:embed-folder-faces` |
| `face-clustering` | real ✅ | `face:cluster-*` |
| `similar-untagged-counts` | real ✅ | `face:similar-untagged-counts-*` |
| `photo-analysis` | real ✅ | `media:analyze-folder` (legacy trigger path still active) |
| `description-embedding` | real ✅ | inline + `desc-embed-backfill-*` |
| `path-llm-analysis` | stub | `path-llm-*` |
| `semantic-index` | real ✅ | `semantic:rebuild-*` |
| `desc-embedding-backfill` | real ✅ | `desc-embed-backfill-*` |

Deleting any legacy channel before its pipeline is wrapped would
break the corresponding feature.

### Migration recipe (per pipeline)

Use `apps/desktop-media/electron/pipelines/definitions/gps-geocode.ts`
as the canonical reference. For each stub:

1. **Move runner body.** Move the body of the legacy `run*Job` function
   into a `PipelineDefinition.run`. Replace the per-feature progress
   emitter calls (e.g.
   `emitFaceDetectionProgress(window, { type: "item-updated", … })`)
   with `ctx.report({ type: "item-updated", processed, total })`.
2. **Cancellation.** Replace `runningJobs.get(jobId)?.cancelled`
   checks and the per-job `AbortController` with `ctx.signal.aborted`
   / `ctx.signal.addEventListener("abort", …)`. The scheduler hands
   each job its own `AbortSignal`.
3. **Typed I/O.** Define typed `Params` and `Output` interfaces.
   Inputs that are easy to chain (e.g. `mediaItemIds`) belong in
   `Params`; everything else in `Output` so downstream jobs can read
   it via `inputBinding.mapper`.
4. **Register.** Add the definition in
   `apps/desktop-media/electron/pipelines/definitions/index.ts`
   (replace the stub entry).
5. **Facade the IPC channel.** Convert the legacy IPC handler into
   a thin facade: build a single-job `BundleSpec`, call
   `pipelineScheduler.enqueueBundle(...)`, and forward the bundle id
   as the legacy job id. This keeps existing renderer hooks working
   while the slice migration happens.
6. **Migrate renderer state.** Update the renderer's per-feature
   slice (`packages/media-store/src/slices/`) to subscribe to
   `pipelineQueueSlice` instead of the legacy `bind*Progress` events.
   Keep both paths until step 7.
7. **Delete the legacy facade.** Once the renderer no longer
   subscribes to the legacy progress events, delete the facade IPC
   handler, the corresponding `IPC_CHANNELS.*` entries, and the
   `runningXxxJobs` map in
   `apps/desktop-media/electron/ipc/state.ts`.

### Suggested order of work

Each step is independently shippable. Items earlier in the list
unblock later ones (input bindings, presets):

1. **`path-llm-analysis`** — standalone, can land any time.

After step 7, the actual Phase 7 deletions become safe:

- Delete every legacy IPC channel except `pipelines:*`.
- Delete `runningJobs` / `runningFaceDetectionJobs` /
  `runningPhotoAnalysisJobs` / etc. from
  `apps/desktop-media/electron/ipc/state.ts`.
- Delete `bind*Progress` files in
  `apps/desktop-media/src/renderer/hooks/ipc-progress-binders/`.
- Replace `IPC_CHANNELS.getActiveJobStatuses` with
  `pipelines:get-snapshot`.
- Delete every per-feature slice in
  `packages/media-store/src/slices/` that has been folded into
  `pipelineQueueSlice`.

---

## 3. UX gaps tracked separately

- **"Run all main pipelines on this folder" action** — listed by
  user as future work; the orchestration foundation is the prerequisite.
  When implemented, this should be a preset (`full-folder-index`)
  triggered from the folder context menu and the dashboard.
- **Per-pipeline `Output` not yet visible in the dock** — currently the
  dock only shows progress, not return values. Once `metadata-scan`
  emits `{ scannedCount, gpsCandidateCount }`, the dock should surface
  it under the bundle's "Recently finished" entry.
