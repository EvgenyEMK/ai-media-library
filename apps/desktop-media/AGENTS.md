# AGENTS.md — desktop-media (Electron App)

## Overview

Electron desktop app for local media library management with AI-powered analysis.
Uses Vite for bundling, React 19 for the renderer, SQLite for persistence, and local AI models (Ollama) plus optional cloud AI.

---

## Architecture

```
electron/               # Main process (Node.js)
  main.ts               # App lifecycle entry (thin — delegates to modules)
  ipc/                  # IPC handler modules grouped by feature
  db/                   # SQLite database modules
  *.ts                  # AI pipelines, face detection, sidecar management
src/
  renderer/             # React renderer process
    App.tsx             # Root component (thin orchestrator)
    components/         # Desktop-specific UI components
    hooks/              # Desktop-specific React hooks
    stores/             # Zustand store composition (shared slices + DesktopSlice)
    lib/                # Utilities, formatters, constants
    types/              # Desktop-specific types
    actions/            # Automatable action registries
  shared/
    ipc.ts              # IPC channel definitions and types (shared between main and renderer)
```

---

## Key Conventions

### IPC Handlers

- All IPC channels are defined in `src/shared/ipc.ts` (`IPC_CHANNELS` constant).
- Handler registration is grouped by feature domain in `electron/ipc/`:
  - `folder-handlers.ts`, `analysis-handlers.ts`, `face-handlers.ts`, `metadata-handlers.ts`, `semantic-handlers.ts`, `settings-handlers.ts`
- Central registration in `electron/ipc/register-all.ts`.
- Each handler file exports a `register*Handlers(deps)` function that receives dependencies (BrowserWindow, database, etc.).

**People directory — similar face counts:** Cached counts ship with `listPersonTagsWithFaceCounts` (`person_centroids.similar_untagged_face_count`). On-demand live recompute uses `startSimilarUntaggedFaceCountsJob` / `cancelSimilarUntaggedFaceCountsJob` and `similarUntaggedCountsProgress` events (`electron/ipc/face-tags-handlers.ts`). Renderer: `DesktopPeopleTagsListTab`, `bindSimilarUntaggedCountsProgress`, `DesktopProgressDock`. Product UX: `docs/PRODUCT-FEATURES/AI/PEOPLE-FACE-TAGS.md`, `docs/PRODUCT-FEATURES/media-library/BOTTOM-APP-PANEL-UX.md` §5.

### Store Composition

- Desktop store composes all 11 shared slices from `@emk/media-store` plus `DesktopSlice`.
- Store is created in `src/renderer/stores/desktop-store.tsx` via `createDesktopStore()`.
- `DesktopSlice` manages: library roots, folder tree, folder analysis status, face/photo analysis settings.
- Use `useDesktopStore(selector)` for reactive reads, `useDesktopStoreApi()` for imperative access.

### Automatable Actions

- All user-facing operations (open folder, start analysis, toggle fullscreen, search, etc.) must be exposed as named functions in action registries under `src/renderer/actions/`.
- Action functions receive explicit parameters and call store actions or IPC — they never read React component state directly.
- UI components and automation scripts call the same action functions.

### SQLite Database

- Modules in `electron/db/` — one file per domain (media-analysis, face-embeddings, face-tags, semantic-search, etc.).
- Use `getDesktopDatabase()` from `electron/db/client.ts` to get the database instance.
- Vector search via `SQLiteVectorStoreAdapter` in `electron/db/vector-store.ts` (implements `VectorStoreAdapter` from `@emk/shared-contracts`).

### Provider Adapters

Desktop implements the shared adapter interfaces from `@emk/shared-contracts`:

| Interface | Desktop Adapter | Location |
|-----------|----------------|----------|
| `VectorStoreAdapter` | `SQLiteVectorStoreAdapter` | `electron/db/vector-store.ts` |
| `EmbeddingProviderAdapter` | `OllamaEmbeddingAdapter` | `electron/adapters/ollama-embedding-adapter.ts` |
| `AiProviderAdapter` | Ollama (inline, wrap when needed) | `electron/photo-analysis.ts` |
| `FaceDetectionProviderAdapter` | RetinaFace sidecar (wrap when needed) | `electron/face-detection.ts` |
| `MediaRepository` | SQLite modules (wrap when needed) | `electron/db/*.ts` |

To swap a provider (e.g., replace Ollama with a different embedding model), create a new adapter class implementing the shared interface and register it in place of the current one.

### AI Pipelines

- Photo analysis: `electron/photo-analysis.ts` (model interaction) + `electron/photo-analysis-pipeline.ts` (orchestration with rotation).
- Face detection: `electron/face-detection.ts` (API calls to RetinaFace sidecar).
- Face embedding: `electron/face-embedding.ts` (CLIP embeddings via Ollama).
- Semantic search: `electron/semantic-embeddings.ts` (multimodal embedding).
- All AI operations go through provider interfaces from `@emk/shared-contracts`.

### ExifReader + XMP in Node

- Pass **`domParser: createExifReaderDomParser()`** from `@emk/media-metadata-core` into **`ExifReader.load`** so XMP blocks parse under Vite-bundled Electron main (native `DOMParser` is absent there). Dependency: **`@xmldom/xmldom`** (via `@emk/media-metadata-core`).

### Metadata scan completion vs AI follow-up

- `upsertMediaItemFromFilePath` (`electron/db/media-item-metadata.ts`) returns `needsAiPipelineFollowUp`: true for **new** catalog rows or when **`invalidateMediaItemAiAfterMetadataRefresh`** runs (content/geometry/hash-driven invalidation per `shouldInvalidateAiAfterCatalogUpdate`); false for metadata-only updates that skip invalidation.
- `runMetadataScanJob` (`electron/ipc/metadata-scan-handlers.ts`) aggregates **`filesNeedingAiPipelineFollowUp`** and per-folder **`needsAiFollowUp`** into `MetadataScanProgressEvent` `job-completed` (`src/shared/ipc.ts`).
- Renderer (`bindMetadataScanProgress`): **`foldersWithCatalogChanges`** (sidebar amber outline) reflects folders with catalog **created** or **updated**, including non-invalidating updates. `job-completed` still carries **`filesNeedingAiPipelineFollowUp`** for logs and future UI. Product UX: `docs/PRODUCT-FEATURES/media-library/FOLDER-ANALYTICS-MENU-UX.md` §7.2–7.4.

### AI image search (hybrid)

Desktop **AI image search** ranks primarily from **vision** and **description-vector** similarity, merged with **Reciprocal Rank Fusion (RRF)**:

1. **Vision** — query text embedded with `search_query:` vs stored **image** embeddings (same job as “Index images for AI search”).
2. **Description vectors** — query vs **text** embeddings built with `search_document:` from AI title+description (written after analysis; folder-scoped **AI description embedding** menu backfills older libraries — temporary UI).
3. **SQLite FTS5** over AI title/description runs **in parallel** for diagnostics; it is **not** merged into RRF.

Optional **keyword re-rank** after RRF (Advanced search + **Settings → Keyword match reranking** + per-modality keyword thresholds) re-orders by keyword hit count, then raw RRF score.

Product UX and behavior: `docs/PRODUCT-FEATURES/AI/AI-SEARCH-DESKTOP.md`.

### Sidecar Processes

- RetinaFace Python service runs as a child process.
- Managed in the main process with health checks and graceful shutdown.
- Port management and conflict resolution handled at startup.

---

## Styling (renderer)

- **Tailwind** is the primary styling method for `src/renderer/`. Prefer utility classes on `className` over new rules in [`styles.css`](src/renderer/styles.css).
- Use **theme tokens** from [`tailwind.config.ts`](tailwind.config.ts) / `:root` CSS variables (e.g. `bg-card`, `text-foreground`, `border-border`, `bg-secondary`, `text-muted-foreground`). Avoid hardcoded hex unless bridging a one-off color.
- **Do not add new BEM-style class blocks** to `styles.css` for new UI. Reserve `styles.css` for `@tailwind` layers, `:root` tokens, `@layer base` resets, and rare cases Tailwind cannot express (e.g. some `::webkit-details-marker` rules).
- Use **`cn()`** from [`src/renderer/lib/cn.ts`](src/renderer/lib/cn.ts) (`clsx` + `tailwind-merge`) for conditional / merged classes. Shared `@emk/media-viewer` components stay Tailwind-free inside the package; the desktop app wraps them with Tailwind as needed.
- **`dark` class:** The root layout should keep `class="dark"` on `<html>` (see `main.tsx`) so `darkMode: ["class"]` tokens apply consistently.

---

## Commands

```bash
pnpm dev                  # Start Electron + Vite dev (from monorepo root: pnpm dev:desktop)
pnpm build                # Build main + renderer (Vite) into dist-electron / dist-renderer
pnpm run dist:win         # From apps/desktop-media: NSIS installer under release/ (unsigned; see CI workflow)
pnpm test                 # Run tests (Vitest)
```

This app is intended to be distributed under an open-source license (see `LICENSE` in this directory). The surrounding monorepo may include other proprietary or open-core apps; only files under `apps/desktop-media/` are covered by that license unless noted otherwise.

---

## File Size Limits

| Category | Max lines |
|---|---|
| IPC handler group | 200 |
| React component | 300 |
| Custom hook | 200 |
| Electron main entry | 100 |
| Utility module | 150 |

If a file exceeds these limits, decompose it into focused sub-modules.

---

## Dependencies

- `@emk/media-store` — Shared Zustand slices
- `@emk/media-viewer` — Shared UI components
- `@emk/shared-contracts` — Domain types and adapter interfaces
- `@emk/sdk-media-api` — Sync API client
- `better-sqlite3` — SQLite driver
- `jimp` — Image manipulation
- `exifreader` — EXIF metadata parsing
- `zustand` + `immer` — State management
