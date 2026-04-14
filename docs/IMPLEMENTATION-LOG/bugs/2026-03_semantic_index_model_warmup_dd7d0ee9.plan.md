---
name: Semantic index model warmup
overview: Eliminate the initial burst of failed AI search indexing by running a full dummy vision forward pass before processing real files, and surface a clear "loading model" state in the Background operations panel until that warmup finishes.
todos:
  - id: warmup-inference
    content: Add 224×224 dummy forward pass to warmupVisionPipeline in nomic-vision-embedder.ts
    status: completed
  - id: ipc-phase
    content: Add SemanticIndexProgressEvent phase-updated; emit after warmup in semantic-search-handlers.ts
    status: completed
  - id: store-bind-ui
    content: Add semanticIndexPhase to media-store slice; bind in ipc-progress-binders + App clear; DesktopProgressDock + ui-text
    status: completed
isProject: false
---

# Fix semantic indexing false failures + model-init UX

## Root cause

- Indexing uses ONNX vision embeddings via `[embedImageDirect](apps/desktop-media/electron/nomic-vision-embedder.ts)` (`@huggingface/transformers`).
- `[warmupVisionPipeline()](apps/desktop-media/electron/nomic-vision-embedder.ts)` only awaits `getVisionPipeline()` and `getRawImage()` — it **never runs `pipe(image)`**. Many runtimes only finish session compile / first-inference setup on the first real forward pass, so the first many `embedImageDirect` calls can fail; later calls succeed (matches “~50–70 then normal”).
- App startup `[probeMultimodalEmbeddingSupport()](apps/desktop-media/electron/main.ts)` probes **Ollama** in `[semantic-embeddings.ts](apps/desktop-media/electron/semantic-embeddings.ts)`, not the Nomic ONNX stack — so nothing eagerly proves the vision embedder is inference-ready.

## Implementation

### 1. Real inference warmup (main fix)

In `[apps/desktop-media/electron/nomic-vision-embedder.ts](apps/desktop-media/electron/nomic-vision-embedder.ts)`:

- After the pipeline and `RawImage` are loaded, run **one full forward pass** on a **224×224 RGBA** tensor (solid color is fine). ViT-style models expect reasonable spatial size; tiny images risk a useless or failing warmup.
- Reuse the same `pipe(image)` path as real indexing so ONNX/WASM and the feature-extraction head are exercised.
- Keep errors propagating so `[runSemanticIndexJob](apps/desktop-media/electron/ipc/semantic-search-handlers.ts)` still fails the job cleanly if the model cannot run at all.

### 2. “Initializing model” spinner in Background operations

**IPC** — extend `[SemanticIndexProgressEvent](apps/desktop-media/src/shared/ipc.ts)` with a variant, e.g. `{ type: "phase-updated"; jobId: string; phase: "indexing" }` (single transition from main is enough).

**Main** — in `runSemanticIndexJob`, **immediately after** successful `warmupVisionPipeline()` (and before the per-image loop), call `emitSemanticIndexProgress` with `phase-updated` / `indexing`. That marks the end of model init without an extra “start init” event from main.

**Store** — in `[packages/media-store/src/slices/semantic-search.ts](packages/media-store/src/slices/semantic-search.ts)`, add e.g. `semanticIndexPhase: "initializing-model" | "indexing" | null`, default `null`.

**Renderer** — in `[ipc-progress-binders.ts](apps/desktop-media/src/renderer/hooks/ipc-progress-binders.ts)`:

- On `job-started`: set `semanticIndexPhase = "initializing-model"`.
- On `phase-updated` (matching `jobId`): set `semanticIndexPhase = "indexing"`.
- On `job-completed`: set `semanticIndexPhase = null`.

Also set `semanticIndexPhase = null` in `[App.tsx](apps/desktop-media/src/renderer/App.tsx)` `handleIndexSemantic` when clearing state on invoke, so a retry does not leak the previous phase.

**UI** — in `[DesktopProgressDock.tsx](apps/desktop-media/src/renderer/components/DesktopProgressDock.tsx)`, when semantic indexing is running and phase is `initializing-model`, show the existing loader pattern (same as metadata “preparing”) plus a short label, e.g. new string in `[ui-text.ts](apps/desktop-media/src/renderer/lib/ui-text.ts)`: “Loading vision embedding model…”.

While `initializing-model`, prefer showing this row **above** (or instead of) the per-item progress bar so users do not interpret stalled “Processed: 0/total” as a hang without explanation. Once phase is `indexing`, show the normal progress track and counts.

## Files to touch (concise)


| Area                    | File                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Warmup                  | `[apps/desktop-media/electron/nomic-vision-embedder.ts](apps/desktop-media/electron/nomic-vision-embedder.ts)`                             |
| Emit phase after warmup | `[apps/desktop-media/electron/ipc/semantic-search-handlers.ts](apps/desktop-media/electron/ipc/semantic-search-handlers.ts)`               |
| IPC types               | `[apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts)`                                                             |
| Zustand slice           | `[packages/media-store/src/slices/semantic-search.ts](packages/media-store/src/slices/semantic-search.ts)`                                 |
| Progress binding        | `[apps/desktop-media/src/renderer/hooks/ipc-progress-binders.ts](apps/desktop-media/src/renderer/hooks/ipc-progress-binders.ts)`           |
| Dock UI                 | `[apps/desktop-media/src/renderer/components/DesktopProgressDock.tsx](apps/desktop-media/src/renderer/components/DesktopProgressDock.tsx)` |
| Copy                    | `[apps/desktop-media/src/renderer/lib/ui-text.ts](apps/desktop-media/src/renderer/lib/ui-text.ts)`                                         |
| Clear phase on new job  | `[apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx)`                                                       |


## Verification

- Manually: cold start (or clear HF/transformers cache if needed), run “Index images for AI search” on a large folder — **Failed** should not spike at the start; panel shows “Loading vision embedding model…” briefly, then normal progress.
- Optional: run existing `[apps/desktop-media/tests/e2e/semantic-search.spec.ts](apps/desktop-media/tests/e2e/semantic-search.spec.ts)` if the environment is set up (fixture already waits for idle).

