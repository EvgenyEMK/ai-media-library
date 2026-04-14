# AGENTS.md — Monorepo Root

This file provides operational context for AI agents working in this repository.
For full coding rules, see `CLAUDE.md` at the repo root.

---

## Repository Structure

pnpm monorepo with Turborepo orchestration, focused on a desktop-first AI media library.

**App:**
- `apps/desktop-media` — Electron desktop media app (Vite + React + SQLite + local AI)

**Packages:**
- `packages/media-metadata-core` — Metadata types, EXIF/XMP helpers, thumbnail filter logic
- `packages/media-store` — Zustand state slices shared across media apps
- `packages/media-viewer` — Shared React UI components (no Next.js/web-only deps)
- `packages/shared-contracts` — Domain types, adapter interfaces, sync contracts
- `packages/sdk-media-api` — HTTP sync client
- `packages/config-eslint` — Shared ESLint config
- `packages/config-typescript` — Shared TypeScript configs

---

## Common Commands

```bash
# Development
pnpm dev                        # Desktop app (alias for dev:desktop)
pnpm dev:desktop                # desktop-media only

# Quality
pnpm build                      # Build all via Turbo
pnpm lint                       # Lint all
pnpm typecheck                  # Type-check all
pnpm test                       # Run all Vitest tests via Turbo
pnpm test:e2e                   # Desktop Playwright E2E (builds first)
pnpm test:all                   # Both unit + E2E

# Desktop-specific
cd apps/desktop-media && pnpm dev    # Desktop dev (Electron + Vite)
```

---

## Key Architectural Decisions

1. **Desktop-first.** The primary app is `apps/desktop-media`. Shared packages are designed for future cross-platform reuse (web) but desktop is the current focus.

2. **Local AI, local data.** All AI features (photo analysis, face detection, semantic search) run via locally hosted models (Ollama, ONNX) and a local SQLite database. No cloud dependency for core features.

3. **Media apps share state and UI.** `@emk/media-store` (Zustand slices) and `@emk/media-viewer` (React components) are platform-agnostic. Desktop adds `DesktopSlice` on top.

4. **Provider abstraction.** AI, face detection, embedding, and storage use adapter interfaces from `@emk/shared-contracts`. Desktop implements local adapters (Ollama, RetinaFace sidecar, SQLite vector store).

5. **Automatable actions.** UI actions are designed as named, typed functions in action registries — callable by both UI event handlers and programmatic automation. See `CLAUDE.md` section "Automatable Actions Architecture".

---

## Testing

| Type | Location | Runner |
|---|---|---|
| Unit / integration | `apps/desktop-media/electron/**/*.test.ts`, `src/renderer/**/*.test.ts` | Vitest |
| Package unit tests | `packages/*/src/**/*.test.ts` | Vitest |
| Desktop E2E | `apps/desktop-media/tests/e2e/` | Playwright |

Run `pnpm test` for unit tests, `pnpm test:e2e` for E2E, `pnpm test:all` for both.

Some E2E specs need local image fixtures not in the repository. See [docs/desktop-e2e-local-assets.md](docs/desktop-e2e-local-assets.md).

---

## Documentation

Project documentation lives in `docs/`:
- **`END-USER-GUIDE/`** — non-technical overview and install guide
- **`PRODUCT-FEATURES/`** — product/UX specs organized by module (`AI/`, `media-library/`, `installer/`, `metadata/`)
- **`IMPLEMENTATION-LOG/`** — records of feature implementations (`features/`), bug fixes (`bugs/`), and refactoring (`refactoring/`)
- **`ROADMAP/`** — planned features and future directions
- **`ARCHITECTURE/`** — technical architecture and system design

---

## Scoped Agent Rules

Each app and key package has its own `AGENTS.md` with specific conventions:
- `apps/desktop-media/AGENTS.md` — Electron, IPC, SQLite, AI pipeline patterns
- `packages/media-store/AGENTS.md` — Zustand slice conventions
- `packages/media-viewer/AGENTS.md` — Shared UI component rules
- `packages/shared-contracts/AGENTS.md` — Domain types and adapter interfaces
