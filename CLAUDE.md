# CLAUDE.md — Project-Wide Coding Rules

This file is the **source of truth** for AI-assisted code generation across this monorepo.
It is read by Claude Code automatically. Cursor reads the equivalent rules from `.cursor/rules/`.
Keep both in sync; this file is the canonical reference.

---

## Project Overview

**ai-media-library** is a pnpm monorepo focused on a desktop-first AI media library:

| App / Package | Stack | Purpose |
|---|---|---|
| `apps/desktop-media` | Electron, Vite, React 19, Tailwind, SQLite, Zustand | Desktop media library with local AI |
| `packages/media-metadata-core` | TypeScript only | Metadata types, EXIF/XMP helpers, thumbnail filter logic |
| `packages/media-store` | Zustand 5, Immer | Shared state slices for media apps |
| `packages/media-viewer` | React (no Next.js deps) | Shared UI components for media apps |
| `packages/shared-contracts` | TypeScript only | Domain types, adapter interfaces, sync contracts |
| `packages/sdk-media-api` | TypeScript only | HTTP client for sync API |
| `packages/config-eslint` | ESLint | Shared lint config |
| `packages/config-typescript` | TypeScript | Shared tsconfig bases |

The architecture keeps shared contracts, state slices, and UI components reusable across desktop and (future) web apps.

---

## Workspace Commands

```bash
pnpm dev                    # Desktop app (same as pnpm dev:desktop)
pnpm dev:desktop            # desktop-media only
pnpm build                  # Build all (Turbo)
pnpm lint                   # Lint all
pnpm typecheck              # Type-check all
pnpm test                   # Run all Vitest tests (Turbo)
pnpm test:e2e               # Desktop Playwright E2E (builds first)
pnpm test:all               # Both unit + E2E
```

---

## Architecture Principles

### 1. TypeScript Strictness

- Enforce `strict`, `noImplicitAny`, `isolatedModules`.
- **Never use `any`.** Use proper types, `unknown`, or type assertions.
- All functions and components must have typed parameters and explicit return types.
- Do not add `import React from 'react'` — JSX transform handles it.

### 1a. Cross-Platform Paths

- GitHub unit tests run on Linux. Do not assume Node's default `path` module uses Windows semantics.
- When parsing persisted or catalog paths that may contain backslashes, choose `path.win32` for Windows-style strings and `path.posix` for POSIX strings.
- Tests that use Windows sample paths (for example `C:\...`) must pass on Linux CI; avoid assertions that only work on a Windows developer machine.

### 2. File Size and Decomposition

**Hard limits:**

| Category | Max lines | Action when exceeded |
|---|---|---|
| React component | 300 | Extract sub-components or hooks |
| Custom hook | 200 | Split into focused hooks |
| Utility / helper | 150 | Split by domain |
| Type definitions | 200 | Split by domain |
| IPC handler group | 200 | Split by feature |
| Electron main entry | 100 | Delegate to modules |

**Decomposition rules:**
- One concern per file. A component file renders UI; a hook file manages state/effects; a utility file exports pure functions.
- Extract inline handler logic exceeding ~15 lines into a named function or hook.
- Keep JSX return blocks readable — extract complex conditional sections into sub-components.
- Name files by what they export: `use-folder-actions.ts`, `label-formatters.ts`, `DesktopProgressDock.tsx`.

### 3. Automatable Actions Architecture (Command Pattern)

All user-facing actions must be designed to be invokable **both** by direct user interaction **and** by programmatic automation (AI intent translation, scripting, testing).

**Pattern:** Separate action _intent_ (what to do) from action _trigger_ (how it was initiated).

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  UI trigger  │────>│              │     │              │
│  (onClick)   │     │   Action     │────>│   Store /    │
│              │     │   Registry   │     │   Side-effect│
│  Automation  │────>│              │     │              │
│  (script)    │     └──────────────┘     └──────────────┘
└──────────────┘
```

**Rules:**
- Define each discrete user action as a **named, typed function** with explicit parameters — not as an anonymous handler bound to a button.
- Group related actions into an **action registry** (object or module) so automation can discover and invoke them.
- Action functions must not depend on React component state directly. They receive parameters and call store actions or IPC.
- UI components call these action functions; automation scripts call the same functions.
- Actions must be idempotent where possible, or clearly document side-effects.

**Scope:** Apply this pattern progressively. New actions must follow it. Existing actions are migrated during refactoring phases.

### 4. DRY and Reusability

- Create a reusable component when the same pattern appears 2+ times.
- Shared UI lives in `packages/media-viewer` (cross-platform).
- Shared state logic lives in `packages/media-store` slices.
- Shared types and contracts live in `packages/shared-contracts`.
- Metadata helpers live in `packages/media-metadata-core`.
- Before creating a new component, check existing shared packages.

### 5. Provider Abstraction

All external integrations must use adapter/strategy interfaces defined in `packages/shared-contracts`:

| Domain | Interface | Desktop Adapter |
|---|---|---|
| AI photo analysis | `AiProviderAdapter` | Ollama (local) |
| Text/image embedding | `EmbeddingProviderAdapter` | `OllamaEmbeddingAdapter` |
| Face detection | `FaceDetectionProviderAdapter` | RetinaFace sidecar |
| Vector search | `VectorStoreAdapter` | `SQLiteVectorStoreAdapter` |
| Data access | `MediaRepository` | SQLite db modules |

Never call a provider directly from business logic — always go through the interface.
When adding a new provider, implement the shared interface and register it in the app's adapter configuration.

### 6. Security

- Never log or expose secrets.
- Load env vars through `process.env` in the main process only.
- Never expose service keys in renderer code.

### 7. Accessibility

- Semantic HTML, proper ARIA attributes.
- Keyboard-accessible components.

---

## Styling

- **Tailwind CSS** is the primary styling method for the desktop renderer.
- Use standard theme colors: `primary`, `secondary`, `background`, `foreground`, `muted`, `accent`, `destructive`.
- Dark mode via `darkMode: ["class"]` with `class="dark"` on `<html>`.
- `@emk/media-viewer` must NOT use `lucide-react`, `next/image`, or shadcn. Use inline SVGs.
- Desktop renderer uses `src/renderer/lib/cn.ts` (`clsx` + `tailwind-merge`) for conditional classes.
- Do not add new BEM-style class blocks to `styles.css`; keep it for `@tailwind` layers, tokens, and unavoidable resets.

---

## State Management (Zustand)

- Shared slices in `packages/media-store` (11 slices).
- Desktop composes shared slices + `DesktopSlice` in `apps/desktop-media/src/renderer/stores/`.
- Use Immer middleware for immutable updates. `enableMapSet()` for `Set`/`Map` support.
- Keep stores modular — one slice per concern.

---

## Testing Standards

- **Unit tests:** Pure functions, utilities, store slices, action registries. Runner: **Vitest**.
- **Component tests:** Shared media-viewer components (React Testing Library).
- **Integration tests:** Provider adapters with mocks, IPC handler logic.
- **E2E tests:** **Playwright** for desktop (`apps/desktop-media/tests/e2e/`).
- Every extracted module from refactoring must have at least basic unit tests.
- Test files co-locate with source: `foo.ts` -> `foo.test.ts`, or in a `__tests__/` directory.

---

## File Organization

```
apps/
  desktop-media/              # Electron app
    electron/                 # Main process (IPC handlers, DB, AI pipelines)
      ipc/                    # IPC handler modules (by feature group)
      db/                     # SQLite modules
    src/renderer/             # React renderer
      components/             # Desktop-specific components
      hooks/                  # Desktop-specific hooks
      stores/                 # Desktop store composition
      lib/                    # Desktop utilities
      types/                  # Desktop types
      actions/                # Automatable action registries
packages/
  media-metadata-core/        # Metadata types, EXIF/XMP, thumbnail filters
  media-store/                # Zustand slices (shared state)
  media-viewer/               # Shared React UI components
  shared-contracts/           # Domain types, adapter interfaces
  sdk-media-api/              # Sync HTTP client
docs/                         # Project documentation
  END-USER-GUIDE/             # Non-technical user docs
  PRODUCT-FEATURES/           # Product/UX specs by module
    AI/                       # AI feature specs
    media-library/            # Core library UX
    installer/                # Installer UX
    metadata/                 # Metadata/tagging specs
  IMPLEMENTATION-LOG/         # Implementation records
    features/                 # Feature implementation plans
    bugs/                     # Bug fix records
    refactoring/              # Refactoring plans
  ROADMAP/                    # Planned features
  ARCHITECTURE/               # Technical architecture docs
```

---

## Documentation

Product and architecture documentation lives in `docs/`. See:
- **End-user docs:** `docs/END-USER-GUIDE/` — overview and install guide.
- **Product features:** `docs/PRODUCT-FEATURES/` — UX specs organized by module, with a dedicated `AI/` subfolder for AI feature specs.
- **Implementation log:** `docs/IMPLEMENTATION-LOG/` — records of feature implementations, bug fixes, and refactoring.
- **Roadmap:** `docs/ROADMAP/` — planned features and directions.
- **Architecture:** `docs/ARCHITECTURE/` — technical architecture and system design.

---

## Agent Rules Hierarchy

This project uses a dual-tool setup for AI agents:

| Tool | Config Location | Scope |
|---|---|---|
| Claude Code | `CLAUDE.md` (this file) + `AGENTS.md` files | Root = global, nested = scoped |
| Cursor | `.cursor/rules/*.mdc` | `alwaysApply: true` = global, globs = scoped |

`AGENTS.md` files exist at:
- Root (monorepo overview)
- `apps/desktop-media/` (Electron, IPC, SQLite patterns)
- `packages/media-store/` (Zustand slice conventions)
- `packages/media-viewer/` (Shared UI component rules)
- `packages/shared-contracts/` (Domain types and adapter interfaces)

Keep rule content consistent across both systems. This `CLAUDE.md` is the canonical reference.
