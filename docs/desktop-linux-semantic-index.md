# AI search indexing on Linux / WSL (troubleshooting)

## What “Index images for AI search” actually uses

Indexing runs in the **Electron main process** and embeds each image with **ONNX** via `@huggingface/transformers`:

- **Vision:** `nomic-ai/nomic-embed-vision-v1.5` (quantized)
- **Query side (later, at search time):** `nomic-ai/nomic-embed-text-v1.5`

Models are downloaded on first use into the app **runtime** tree (under **`resolveHuggingfaceModelsRoot`** → typically `…/AI Media Library/ai-models/huggingface/` next to your normal Electron `appData` layout — see [`app-paths.ts`](../apps/desktop-media/electron/app-paths.ts)).

**Ollama and `qwen3.5:9b` are not used for this pipeline.** They matter for **photo analysis**, **folder AI summary**, and **advanced search** query understanding — not for building the vision embedding index (`embedImageDirect` in [`semantic-search-handlers.ts`](../apps/desktop-media/electron/ipc/semantic-search-handlers.ts)).

Startup still **probes** Ollama for legacy status (`probeMultimodalEmbeddingSupport` in [`main.ts`](../apps/desktop-media/electron/main.ts)); Settings may show older “embedding” flags — rely on **`visionOnnxReady`** / **`onnxTextEmbeddingReady`** from **`getSemanticEmbeddingStatus`** for the ONNX path.

## Packaged Linux vs `pnpm dev`

**`pnpm dev`** loads `@huggingface/transformers` from a normal **`node_modules`** directory on disk.

The **`.deb` / AppImage** install puts most dependencies inside **`app.asar`**. Transformers.js resolves ONNX and related files at runtime; when that package stays inside the ASAR archive, **vision warmup often fails immediately** (every indexing item fails with the same warmup error). The fix is to **`asarUnpack`** that package (see `electron-builder.yml`).

If you still see a mismatch after a rebuild, compare **`getSemanticEmbeddingStatus`** and the **AI search indexing** card’s **`topFailureReasons`** between dev and packaged.

## Likely failure modes (Linux / WSL)

1. **Vision warmup fails once → every file fails with the same reason**  
   The job calls `warmupVisionPipeline()` before the per-image loop. Any exception there marks **all** items failed with that error (see `runSemanticIndexJob` in `semantic-search-handlers.ts`).

   Typical causes:
   - **First-time download** from Hugging Face slow, blocked, or incomplete (corrupt cache).
   - **WSL memory**: ONNX + Transformers can OOM; increase WSL RAM or close other apps.
   - **`EMK_ONNX_WASM_MAX_MEMORY_MB`**: default WASM cap is 2048 MB; if you lowered it too much, vision may fail.

2. **`vectorBackendError` non-null**  
   Vector storage init failed (see `getSemanticEmbeddingStatus` → `vectorBackend` / `vectorBackendError` in the same handlers file).

3. **Per-image errors**  
   Decode/path issues (`embedImageWithDecodeFallback`), rotation precheck, or rare ONNX runtime errors. The **progress UI** lists per-item errors; the job summary includes **`topFailureReasons`**.

## How to troubleshoot (no extra `console.log` in app code)

### A. Use the built-in progress / summary UI

After a run, open the **progress / AI search indexing** card: failed items and **`topFailureReasons`** are surfaced from main via IPC (`semanticIndexProgress` → `job-completed` in [`ipc-progress-binders.ts`](../apps/desktop-media/src/renderer/hooks/ipc-progress-binders.ts)).

### B. Opt-in main-process logs

Launch the app with:

```bash
EMK_VERBOSE_ELECTRON_LOGS=1
```

This enables **`logVerbose`** lines in the **Electron main process** (see [`verbose-electron-logs.ts`](../apps/desktop-media/electron/verbose-electron-logs.ts)). They are written to **stderr** (same stream as many Chromium messages).

**Important:** these lines **do not** appear in the renderer **DevTools** console. Watch the **terminal where you started** `pnpm dev` (or the parent `pnpm` process). Indexing uses the **`[semantic-index]`** prefix; interactive search uses **`[semantic-search][main]`**.

The **pipeline queue** job *Build semantic search index* (`semantic-index`) logs with **`[semantic-index][pipeline]`** (see [`pipelines/definitions/semantic-index.ts`](../apps/desktop-media/electron/pipelines/definitions/semantic-index.ts)). The **folder menu / IPC** path uses **`[semantic-index]`** without `[pipeline]` (see [`semantic-search-handlers.ts`](../apps/desktop-media/electron/ipc/semantic-search-handlers.ts)).

On `pnpm dev` startup you should see **`[desktop-media dev] launching Electron (EMK_VERBOSE_ELECTRON_LOGS=…)`** from [`scripts/dev.mjs`](../apps/desktop-media/scripts/dev.mjs) and, when verbose is on, **`[main] EMK_VERBOSE_ELECTRON_LOGS=1`** from [`main.ts`](../apps/desktop-media/electron/main.ts) — if those are missing, the Electron child did not receive the env var.

From a `.deb` install you may need a wrapper script or `env` in the `.desktop` `Exec=` if you start from a menu.

### D. GLib-GObject lines (`g_object_ref` / `G_IS_OBJECT`)

On Linux / WSLg, Electron/Chromium often emits **`GLib-GObject`** assertions to **stderr**. They are usually **noise** and not produced by the semantic indexer. Treat **`[semantic-index]`** / **`[semantic-search]`** lines as the app’s own diagnostics.

### E. Semantic index debug file (optional)

Set:

```bash
EMK_SEMANTIC_DEBUG_LOGS=1
```

Then the main process writes **`semantic-index-debug.log`** under **userData** (path returned by IPC **`getSemanticIndexDebugLogTail`** when enabled — see [`semantic-index-debug-log.ts`](../apps/desktop-media/electron/semantic-index-debug-log.ts)).

### F. Clear a bad Hugging Face / ONNX cache

If logs mention parse errors or bad ONNX:

1. Quit the app.
2. Remove the Hugging Face cache under the runtime root, e.g.  
   `…/AI Media Library/ai-models/huggingface/cache`  
   (and optionally `…/models` under the same `huggingface` folder if a partial model extract exists).
3. Relaunch and re-run indexing so models download again.

### G. Ollama for **photo analysis** (optional, separate from index)

If you want **`qwen3.5:9b`** (or your chosen model) for **analysis** / chat-style features:

```bash
# Example: install Ollama on Ubuntu/WSL — follow https://ollama.com/download/linux
curl -fsSL https://ollama.com/install.sh | sh
ollama serve   # if not already a systemd user service
ollama pull qwen3.5:9b
ollama list
```

Point the app at the same host as Windows if Ollama runs on Windows instead: set **`EMK_OLLAMA_BASE_URL`** (e.g. to the Windows host IP from WSL, not `127.0.0.1`, when Ollama listens only on the Windows side).

## Quick checklist

| Check | What to do |
|--------|------------|
| Indexing vs Ollama | Indexing = **ONNX Nomic**; Ollama = **analysis / LLM search helpers**. |
| Network | Machine must reach **`https://huggingface.co`** for first model pull. |
| RAM (WSL) | Give WSL enough memory for vision + text ONNX sessions. |
| Real error text | Progress UI failures, **`EMK_VERBOSE_ELECTRON_LOGS=1`**, or **`EMK_SEMANTIC_DEBUG_LOGS=1`** + log tail IPC. |
