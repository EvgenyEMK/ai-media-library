# Desktop media (`@emk/desktop-media`)

Electron + React desktop app: a **local-first media library** with **AI-heavy workflows** while keeping **models and data on your machine** (multiple local AI models, **SQLite** catalog, optional offline-friendly components).

## Why this app (vs a typical gallery)

- **Privacy and control:** browse and analyse libraries using **locally hosted AI** and a **local database**—not dependent on a cloud photo platform.
- **Faces:** **detection**, grouping, **person tags**, and **similar-face** style discovery across folders.
- **Semantic / contextual search:** search by **what is in the image** and **AI-generated descriptions** (vision + language indexing), combined with **face similarity**—not just filenames or dates.
- **Places:** GPS → **country / area / city**-style labels for human-friendly browsing and filters.
- **Understanding scenes and documents:** **categories** (people, nature, IDs, invoices, …), **aesthetic quality**, and related fields for filtering.
- **Invoice data extraction:** from images, for example **title, from / total / currency / VAT**.
- **Deep filtering:** **person tags**, **number of people**, **location**, categories, ratings, document modes, and more—aligned with the metadata above.

## Commands

- `pnpm --filter @emk/desktop-media dev` — dev (Electron + Vite)
- `pnpm --filter @emk/desktop-media build` — production bundle
- `pnpm --filter @emk/desktop-media start` — run built app
- `pnpm --filter @emk/desktop-media typecheck`
- `pnpm --filter @emk/desktop-media test` — Vitest
- `pnpm --filter @emk/desktop-media test:e2e` — Playwright (runs `build` first)

From the monorepo root you can use `pnpm test`, `pnpm test:e2e`, or `pnpm test:all`.

## E2E local assets (sensitive / not in git)

Some Playwright tests expect photos under **`test-assets-local/e2e-photos/`** (or `EMK_E2E_PHOTOS_DIR`). That folder is **gitignored** so real-world images (IDs, invoices, addresses, …) are never committed. See the repo doc: [../../docs/desktop-e2e-local-assets.md](../../docs/desktop-e2e-local-assets.md).

## Structure (short)

- `electron/` — main process, IPC, DB, AI pipelines, native face stack
- `electron/preload.ts` — narrow `contextBridge` API
- `src/renderer/` — React UI, Zustand store composition, action registries
- `src/shared/ipc.ts` — IPC contracts shared by main and renderer
