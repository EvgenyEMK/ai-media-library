# AGENTS.md — @emk/media-store

## Overview

Shared Zustand state management for media applications.
Provides 11 composable slices consumed by both `web-media` (via `MediaStoreProvider`) and `desktop-media` (via `DesktopStoreProvider` which adds `DesktopSlice`).

---

## Architecture

```
src/
  create-store.ts         # Store factory (composes all slices, vanilla Zustand)
  react.tsx               # MediaStoreProvider, useMediaStore, useMediaStoreApi
  index.ts                # Public exports
  types.ts                # Shared types (TaskStatus, MediaStoreItem, etc.)
  middleware/
    logger.ts             # Dev-only logging middleware
  components/
    bottom-panel.tsx      # Bottom panel UI component
  slices/
    sidebar.ts            # Sidebar collapse/expand state
    content-pane.ts       # Content pane view mode, selection
    bottom-panel.ts       # Bottom panel visibility
    viewer.ts             # Photo viewer state (open, index, fullscreen)
    media-items.ts        # Media items list, loading, filtering
    albums.ts             # Album selection, list
    face-tags.ts          # Face tag management
    metadata-scan.ts      # Metadata scan progress
    ai-analysis.ts        # AI analysis job progress
    face-detection.ts     # Face detection job progress
    semantic-search.ts    # Semantic search state
```

---

## Key Conventions

### Slice Pattern

Each slice is a `StateCreator` compatible with Zustand + Immer:

```ts
import type { StateCreator } from "zustand";

export interface MySlice {
  myValue: string;
  setMyValue: (value: string) => void;
}

export const createMySlice: StateCreator<MySlice, [["zustand/immer", never]]> = (set) => ({
  myValue: "",
  setMyValue: (value) => set((state) => { state.myValue = value; }),
});
```

### Rules

- **One slice per file.** Each file exports one slice interface and one `create*Slice` factory.
- **No platform-specific logic.** Slices must work in both browser (web) and Electron renderer contexts. No `window.desktopApi`, no `next/navigation`, no server-only imports.
- **Immer for mutations.** All state updates use Immer's `set((state) => { state.x = y; })` pattern.
- **`enableMapSet()` required.** Several slices use `Set` (e.g., `selectedItemIds`). Immer's `enableMapSet()` is called in `create-store.ts`.
- **Types are explicit.** Every slice has a named interface. The combined `MediaStoreState` is a union of all slice interfaces.
- **Action functions in slices.** Store actions (setters, toggles, resets) live in the slice. Complex orchestration that involves IPC or side-effects belongs in hooks or action registries in the app, not in the slice.
- **Max 150 lines per slice.** If a slice grows beyond this, split into sub-concerns.

### Store Composition

- `createMediaStore()` (vanilla) — used by web via `MediaStoreProvider`
- Desktop creates its own store by composing all shared slices + `DesktopSlice`

### Exports

All slices, types, and the store factory are re-exported from `src/index.ts`.
Desktop imports individual slice creators to compose them with `DesktopSlice`.

---

## Testing

- Unit test each slice: verify initial state, test each action, test edge cases.
- Use `createStore` from `zustand/vanilla` in tests (no React needed).
- Mock any external dependencies (there should be none in slices).
