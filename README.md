# ai-media-library

Desktop-first AI media library monorepo.

## Scope (Phase 1)

This public repository currently includes:

- `apps/desktop-media` (Electron desktop app)
- Shared packages used by desktop and designed for future cross-platform reuse:
  - `packages/media-metadata-core`
  - `packages/media-store`
  - `packages/media-viewer`
  - `packages/shared-contracts`
  - `packages/sdk-media-api`
  - `packages/config-eslint`
  - `packages/config-typescript`

The architecture intentionally keeps shared contracts, state slices, and UI components reusable across desktop and web apps.

## What the desktop app offers

**Local-first media library with AI:** catalog, browse, and search your images using **locally hosted AI** (multiple AI models) and a **local SQLite database**—your library is not tied to a cloud photo service.

**Face workflows:** face detection and **face recognition**-style grouping, person tags, and similarity-oriented exploration across your library.

**Contextual / semantic search:** find images by meaning—powered by **AI image indexing** (vision + language: embeddings, AI titles/descriptions) together with **face similarity**, so search goes beyond filenames and EXIF.

**Geo context:** GPS coordinates can be turned into **human-readable place context** (country / region / city style labels) for browsing and filters.

**Rich scene and document signals:** **image categorisation** (people, nature, documents, IDs, invoices, and more), **photo aesthetic quality**, and related metadata you can filter on.

**Data extraction:** from invoice images, **field-style extraction** (e.g. sender, totals, currency, VAT) to support organisation and filters.

**Powerful filters:** combine the above—**person tags**, **people counts**, **locations**, categories, ratings, document types, and more—in the UI and search flows.

Together, this targets users who want **strong AI-assisted organisation** while keeping **data and models under their own control**, unlike typical consumer cloud galleries.

### Shared metadata (`@emk/media-metadata-core`)

Metadata types, EXIF/XMP helpers, accessors, and thumbnail quick-filter logic live in **`packages/media-metadata-core`**. The desktop app imports them as `@emk/media-metadata-core` (no `../` escapes out of `apps/desktop-media`).

## Web app status

`apps/web-media` in this repository is a placeholder only.

The active web-media application is currently maintained in a separate repository and is not published here yet.

## Quick start

```bash
pnpm install
pnpm dev
```

(`pnpm dev` runs the desktop app; same as `pnpm dev:desktop`.)

## Testing

- **Unit / integration (Vitest):** `pnpm test`
- **Desktop E2E (Playwright; runs a full desktop build first):** `pnpm test:e2e`
- **Both:** `pnpm test:all`

Some E2E specs need **local image fixtures** that are **not** in the repository (they may contain sensitive real-world content). See [docs/desktop-e2e-local-assets.md](docs/desktop-e2e-local-assets.md).

## License

- Repository default license: MIT (`LICENSE`)
- AI models / model weights are licensed by their original authors and are not automatically covered by the app code license.
