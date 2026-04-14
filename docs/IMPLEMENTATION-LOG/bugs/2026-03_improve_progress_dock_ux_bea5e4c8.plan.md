---
name: Improve Progress Dock UX
overview: Refactor the desktop-media bottom progress dock into a modern collapsible/expandable strip, remove destructive close behavior, and hide the dock entirely when there is no visible work left.
todos:
  - id: refactor-dock-structure
    content: Refactor DesktopProgressDock to remove global close and add centered top-border collapse control with label.
    status: completed
  - id: update-dock-styles
    content: Update styles.css for thin collapsed strip and rectangular centered toggle button styling.
    status: completed
  - id: align-ui-text
    content: Update ui-text labels/tooltips/aria text used by the new dock control.
    status: completed
  - id: verify-empty-hide
    content: Implement/verify dock hide conditions so panel is not rendered when empty.
    status: completed
  - id: run-lint-check
    content: Run lints on modified desktop-media renderer files and fix introduced diagnostics.
    status: completed
isProject: false
---

# Improve Background Operations Panel

## Goals

- Convert the bottom panel into a pure **collapse/expand** dock (no global close button).
- Place a **rectangular toggle control** centered on the dock top border.
- Render **"Background operations"** label directly on the top border.
- In collapsed mode, keep only a thin bottom strip (label + toggle).
- Hide the dock completely when there are no visible/running tasks (including after users close completed cards or auto-hide applies).

## Implementation Scope

- Update panel structure/behavior in `[C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/components/DesktopProgressDock.tsx](C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/components/DesktopProgressDock.tsx)`.
- Update dock visual design in `[C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/styles.css](C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/styles.css)`.
- Ensure text labels come from `[C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/lib/ui-text.ts](C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/lib/ui-text.ts)`.
- Keep existing panel mount flow in `[C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/App.tsx](C:/EMK-Dev/emk-website/apps/desktop-media/src/renderer/App.tsx)`, only adjusting props/behavior if needed.

## Planned Changes

- In `DesktopProgressDock`:
  - Remove header-level `Close` action that currently force-hides all `*PanelVisible` flags.
  - Add a centered top-border control area containing:
    - the dock label `Background operations`
    - a rectangular expand/collapse toggle button.
  - Preserve per-task close/cancel buttons on individual cards (so users can dismiss completed cards or cancel running tasks).
  - Rework `shouldShow` logic to hide the dock when no task card qualifies for rendering (no running task and no still-visible task cards).
  - Keep collapsed mode rendering as a slim strip only (no cards), expandable via the centered control.
- In `styles.css`:
  - Replace current right-aligned header controls with a centered top-border control cluster.
  - Style toggle as a horizontal rectangle (not square), with clear collapsed/expanded affordance.
  - Reduce collapsed-state height to a thin bottom line while retaining accessible click target.
  - Ensure label and toggle remain visible in collapsed state.
- In `ui-text.ts`:
  - Ensure label and toggle tooltips/aria labels are explicit for expand/collapse and aligned with the new UX copy.

## Validation

- Manual checks in desktop-media:
  - Running job: dock appears expanded/collapsible; no global close button.
  - Collapsed state: only thin strip at bottom with label + centered rectangular toggle.
  - Expand from collapsed works repeatedly.
  - Per-card close/cancel still functions.
  - After all tasks are completed and dismissed/auto-hidden, dock disappears entirely.
- Run lint diagnostics for touched renderer files and resolve any introduced issues.

