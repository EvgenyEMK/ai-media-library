# AGENTS.md — @emk/media-viewer

## Overview

Shared React UI components for media display, consumed by both `web-media` and `desktop-media`.
This package must remain platform-agnostic — no Next.js, no Electron, no web-only dependencies.

---

## Architecture

```
src/
  index.ts                          # Public exports
  types.ts                          # Shared component types
  swiper-viewer.tsx                 # MediaSwiperViewer (photo viewer carousel)
  swiper-viewer.css                 # Viewer styles
  photo-with-info-panel.tsx         # Photo with side info panel
  photo-info-tab-content.tsx        # Info tab content
  face-bounding-box-overlay.tsx     # Face detection overlay
  face-tags-entry-card.tsx          # Face tag entry card
  people-face-workspace.tsx         # People/face management workspace
  main-app-sidebar.tsx              # Sidebar shell component
  settings-controls.tsx             # Settings UI controls
  image-edit-suggestions-view.tsx   # Image edit suggestions
  image-edit-suggestions.css        # Styles for ImageEditSuggestionsView (imported by the TSX file)
  grid/
    media-thumbnail-grid.tsx        # Thumbnail grid layout
    media-item-grid-card.tsx        # Individual thumbnail card
    media-item-actions-menu.tsx     # Per-item action dropdown
```

---

## Key Rules

1. **No web-only dependencies.** Must NOT depend on `lucide-react`, `next/image`, `next/link`, or shadcn `Button`. Use inline SVGs for icons.

2. **No platform-specific logic.** Components must work identically in Next.js and Electron/Vite contexts. Platform-specific behavior (e.g., `file://` URLs for Electron) is handled by the consuming app via props, not inside this package.

3. **Props-driven configuration.** Use props to toggle platform-specific features:
   - `showActionsMenu`, `renderInfoPanel`, `disableAnalyzeAction`, etc.
   - Do NOT fork components per platform.

4. **Shared visual controls.** Both apps must render identical icon-button controls (SVG icons, sizing, placement). Never use emoji or text fallbacks.

5. **Grid + Viewer pairing.** `MediaThumbnailGrid` opens `MediaSwiperViewer`. Do NOT use the swiper-based grid view (marked `OLD DO NOT USE`).

6. **File size limits.** Max 300 lines per component file, max 200 lines per hook. Extract sub-components and hooks when exceeded.

7. **Automatable component APIs.** Viewer and grid components should expose imperative handles or callback props that allow programmatic control (navigate to slide, toggle fullscreen, etc.) for automation support.

---

## Styling

- CSS modules or plain CSS files (e.g., `swiper-viewer.css`).
- No Tailwind in this package (apps apply Tailwind classes via wrapper components).
- Inline styles only where truly necessary for dynamic values.

---

## Testing

- Component tests using React Testing Library.
- Test keyboard navigation, slideshow logic, fullscreen toggle.
- Mock Swiper internals if needed.
