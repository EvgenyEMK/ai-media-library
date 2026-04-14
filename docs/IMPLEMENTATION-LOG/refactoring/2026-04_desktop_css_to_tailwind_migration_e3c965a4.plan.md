---
name: Desktop CSS to Tailwind Migration
overview: Migrate ~2060 lines of hand-written CSS in the desktop-media `styles.css` into Tailwind utility classes applied directly in components, and update agent rules to document Tailwind as the styling standard for the desktop app.
todos:
  - id: phase-0-rules
    content: "Phase 0: Update AGENTS.md, CLAUDE.md, and desktop-media.mdc with Tailwind styling rules"
    status: completed
  - id: phase-1-shell
    content: "Phase 1: Migrate global base + app shell layout (body, .app-shell, .sidebar, .main-panel) ~45 lines"
    status: completed
  - id: phase-2-tree
    content: "Phase 2: Migrate sidebar tree (.tree-*) ~150 lines -> SidebarTree.tsx"
    status: completed
  - id: phase-3-menus
    content: "Phase 3: Migrate panel header + toolbar + dropdown menus (.panel-*, .desktop-icon-button, .desktop-filter-*, .desktop-actions-menu, .custom-select-*, .face-detect-*) ~420 lines"
    status: completed
  - id: phase-4-banners
    content: "Phase 4: Migrate banners & info strips (.folder-ai-pipeline-*, .metadata-scan-followup-*, .face-model-download-*) ~110 lines"
    status: completed
  - id: phase-5-search
    content: "Phase 5: Migrate analysis panels + semantic search (.analysis-*, .semantic-*) ~335 lines"
    status: completed
  - id: phase-6-content
    content: "Phase 6: Migrate content views (.image-grid, .image-card, .desktop-list, .image-edit-*, .desktop-folder-loading, .empty-state) ~330 lines"
    status: completed
  - id: phase-7-viewer
    content: "Phase 7: Migrate viewer + info panel + face cards + progress dock + AI summary (.desktop-viewer-*, .desktop-info-*, .desktop-face-*, .desktop-progress-*, .folder-ai-summary-*) ~580 lines"
    status: completed
  - id: phase-8-cleanup
    content: "Phase 8: Final cleanup -- remove all migrated CSS, verify ~35-50 lines remain, full visual QA"
    status: completed
isProject: false
---

# Desktop CSS-to-Tailwind Migration Plan

## Problem Analysis

`[styles.css](apps/desktop-media/src/renderer/styles.css)` is 2097 lines because the desktop-media renderer was built with **traditional BEM-like CSS classes** before Tailwind was configured. The file contains:

- **Lines 1-3:** Tailwind directives (keep)
- **Lines 5-31:** CSS custom properties / design tokens (keep)
- **Lines 33-55:** Global resets for `body`, `button`, `*` (~20 lines)
- **Lines 57-2097:** ~2040 lines of hand-written CSS for ~30 UI concerns

**Why Tailwind isn't used consistently:** The app was built iteratively. Early components (SidebarTree, SemanticSearchPanel, DesktopActionsMenu, etc.) used CSS classes. Tailwind was added later, and newer components (People UI, FaceClusterGrid, FaceTagsTab) use Tailwind directly. Nobody went back to migrate the old code, and **the agent rules never mandated Tailwind for desktop-media**.

### Current Component Styling Split


| Styling approach              | Components                                                                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Only `styles.css` classes** | SidebarTree, DesktopActionsMenu, FolderAnalysisMenuSection, QuickFiltersMenu, SemanticSearchPanel, ToolbarIconButton, DesktopProgressDock, DesktopViewerInfoPanel, DesktopInfoSection, DesktopFolderAiPipelineStrip, DesktopMetadataScanFollowUpBanner, DesktopFaceModelDownloadBanner |
| **Only Tailwind utilities**   | DesktopFaceClusterGrid, DesktopFaceTagsTabContent, DesktopPeopleGroupsTab, DesktopPeopleSection, DesktopPeopleTagsListTab, DesktopPeopleWorkspace, FaceSelectionFooter, FaceThumbWithPreview, people-directory-*, people-pagination-bar, ui/input, ui/select                           |
| **Both (mixed)**              | App.tsx, DesktopFolderAiSummaryView, DesktopSettingsSection, semantic-search-person-tags-bar                                                                                                                                                                                           |


### Hardcoded Colors Problem

Older CSS uses ~40 hardcoded hex colors (e.g., `#0f1115`, `#121724`, `#2a3040`, `#1a2030`). Newer sections correctly use `hsl(var(--border))`, `hsl(var(--card))`, etc. Migration should replace hex colors with Tailwind theme tokens (`border`, `card`, `muted`, `background`, `foreground`, etc.) wherever possible.

---

## Rules Gap

The agent rules have no desktop-media styling guidance:


| File                                                                 | Mentions Tailwind for desktop?                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `[apps/desktop-media/AGENTS.md](apps/desktop-media/AGENTS.md)`       | No styling section at all                                          |
| Root `[CLAUDE.md](CLAUDE.md)`                                        | Desktop stack line omits Tailwind; styling section is web-oriented |
| `[.cursor/rules/desktop-media.mdc](.cursor/rules/desktop-media.mdc)` | No styling section                                                 |
| Root `[AGENTS.md](AGENTS.md)`                                        | Not mentioned                                                      |


Despite this, Tailwind IS properly configured: `[tailwind.config.ts](apps/desktop-media/tailwind.config.ts)` has `content` paths, theme extensions with CSS variable colors, `darkMode: ["class"]`, and `tailwindcss-animate`.

---

## Migration Strategy

Each phase targets a cohesive UI area. For each CSS block being migrated:

1. Move styles into Tailwind utility `className` strings in the corresponding component(s)
2. Replace hardcoded hex colors with theme tokens (e.g., `#2a3040` -> `border`, `#121724` -> `bg-card`)
3. Delete the CSS rules from `styles.css`
4. Test that the UI area looks and behaves identically

### Things that stay in CSS

- `:root` CSS custom properties (design tokens consumed by Tailwind config)
- `@tailwind` directives
- `@keyframes` that cannot be replaced by `tailwindcss-animate` utilities
- Complex pseudo-selectors (`:has()`, `::webkit-details-marker`) if not expressible in Tailwind

### Color mapping reference (approximate)

```
#0f1115  -> bg-background
#eef1f8  -> text-foreground
#121724, #121a2a -> bg-card (or a custom shade)
#151c2d  -> bg-card (slight variant)
#1a2030  -> bg-secondary
#2a3040, #2e374d -> border-border
#333947  -> border-input
#c5d3ef  -> text-muted-foreground (lighter variant)
#a5b5d6  -> text-muted-foreground
#79d7a4  -> text-success (hsl(var(--success)))
#6366f1  -> primary or accent (indigo, may need a token)
#f87171  -> text-destructive
```

Some hex values have no direct token match and will need custom Tailwind colors or be kept as arbitrary values `bg-[#hex]` temporarily.

---

## Phases

### Phase 0: Update Agent Rules

Add a **Styling** section to:

- `[apps/desktop-media/AGENTS.md](apps/desktop-media/AGENTS.md)`
- `[.cursor/rules/desktop-media.mdc](.cursor/rules/desktop-media.mdc)`
- Root `[CLAUDE.md](CLAUDE.md)` (update desktop-media stack line to include Tailwind)

Document:

- Tailwind is the primary styling method for the desktop renderer
- Use theme tokens (`bg-card`, `text-foreground`, `border-border`) not hardcoded hex
- No new CSS classes in `styles.css` -- all new styling via Tailwind utilities
- `cn()` helper (from `clsx` + `tailwind-merge` or similar) for conditional classes

**Test:** N/A (docs only)

### Phase 1: Global Base + App Shell Layout

**CSS lines ~33-77** (~45 lines): `body`, `button`, `*` resets, `.app-shell`, `.app-shell-collapsed`, `.sidebar`, `.sidebar.collapsed`, `.sidebar-header`

**Components affected:** `[App.tsx](apps/desktop-media/src/renderer/App.tsx)` (shell divs)

**Work:**

- Move `.app-shell` grid layout into `App.tsx` as `className="grid grid-cols-[320px_1fr] h-screen"` (with collapsed variant `grid-cols-[84px_1fr]`)
- Move `.sidebar` styles inline
- Move `.main-panel`, `.main-content` styles inline
- Keep `body` / `*` resets as minimal global CSS (or use Tailwind `@layer base`)

**Test:** App loads, sidebar/main split correct, sidebar collapse toggle works

### Phase 2: Sidebar Tree

**CSS lines ~84-232** (~150 lines): `.tree-row`, `.tree-expand-button`, `.tree-select-button`, `.tree-label`, `.tree-status-icon`, `.tree-row-menu-`*, `.tree-row-catalog-changed`, `@keyframes tree-status-spin`

**Components affected:** `[SidebarTree.tsx](apps/desktop-media/src/renderer/components/SidebarTree.tsx)`

**Work:**

- Replace all `.tree-`* class references with Tailwind utilities
- Use `animate-spin` for the spinner keyframe
- Handle hover-based menu visibility: `.tree-row:hover .tree-row-menu-wrap` -> Tailwind `group` / `group-hover:opacity-100`
- Status icon colors (`.state-analyzed`, `.state-not_scanned`, etc.) -> conditional Tailwind classes

**Test:** Folder tree renders, nodes expand/collapse, hover menus appear, status icons colored correctly, context menu opens

### Phase 3: Panel Header, Toolbar, and Dropdown Menus

**CSS lines ~347-764** (~420 lines): `.main-panel`, `.panel-header`, `.panel-folder-path`, `.panel-action-buttons`, `.desktop-icon-button`, `.desktop-filter-`*, `.desktop-actions-menu`, `.desktop-actions-submenu`, `.analysis-option-row`, `.custom-select-*`, `.face-detect-*`, `.folder-ai-summary-menu-*`, `@keyframes spin`, `.spinning`

**Components affected:**

- `[ToolbarIconButton.tsx](apps/desktop-media/src/renderer/components/ToolbarIconButton.tsx)`
- `[QuickFiltersMenu.tsx](apps/desktop-media/src/renderer/components/QuickFiltersMenu.tsx)`
- `[DesktopActionsMenu.tsx](apps/desktop-media/src/renderer/components/DesktopActionsMenu.tsx)`
- `[FolderAnalysisMenuSection.tsx](apps/desktop-media/src/renderer/components/FolderAnalysisMenuSection.tsx)`
- `[App.tsx](apps/desktop-media/src/renderer/App.tsx)` (panel header section)

**Work:**

- Inline panel header layout as Tailwind
- Toolbar icon button -> small component with Tailwind
- Custom select dropdown -> Tailwind utilities (absolute positioning, shadows, etc.)
- Filter menu -> Tailwind with active state classes
- Use `animate-spin` for `.spinning`

**Test:** Panel header renders, all toolbar buttons work, action menu opens/closes, filter menu toggles, custom selects open and select correctly

### Phase 4: Banners and Info Strips

**CSS lines ~234-345** (~110 lines): `.folder-ai-pipeline-strip`, `.folder-ai-pipeline-chip`, `.metadata-scan-followup-banner`, `.face-model-download-banner`

**Components affected:**

- `[DesktopFolderAiPipelineStrip.tsx](apps/desktop-media/src/renderer/components/DesktopFolderAiPipelineStrip.tsx)`
- `[DesktopMetadataScanFollowUpBanner.tsx](apps/desktop-media/src/renderer/components/DesktopMetadataScanFollowUpBanner.tsx)`
- `[DesktopFaceModelDownloadBanner.tsx](apps/desktop-media/src/renderer/components/DesktopFaceModelDownloadBanner.tsx)`

**Work:**

- Move banner layout + gradient backgrounds into component `className`
- Replace hardcoded hex with theme tokens where possible
- Gradient backgrounds (`linear-gradient(90deg, #2a2215, #1a2030)`) -> Tailwind arbitrary `bg-gradient-to-r from-[...] to-[...]` or keep as inline style

**Test:** AI pipeline chips display, metadata scan banner shows/dismisses, face model download banner renders

### Phase 5: Analysis Panels and Semantic Search

**CSS lines ~766-1101** (~335 lines): `.analysis-panel`, `.analysis-header`, `.analysis-error`, `.analysis-item`, `.analysis-result-`*, `.analysis-prompt-block`, `.semantic-search-*`, `.semantic-scope-*`, `.semantic-person-*`, `.semantic-advanced-*`, `.semantic-unconfirmed-*`

**Components affected:**

- `[SemanticSearchPanel.tsx](apps/desktop-media/src/renderer/components/SemanticSearchPanel.tsx)`
- `[semantic-search-person-tags-bar.tsx](apps/desktop-media/src/renderer/components/semantic-search-person-tags-bar.tsx)`
- Analysis item rendering in `[App.tsx](apps/desktop-media/src/renderer/App.tsx)` or `[DesktopProgressDock.tsx](apps/desktop-media/src/renderer/components/DesktopProgressDock.tsx)`

**Work:**

- Semantic search is the largest single CSS domain (~250 lines) -- person chips, scope groups, radio labels, search results dropdown
- Analysis items (error/success states, JSON blocks, prompt collapsibles) -> Tailwind
- Complex selectors like `.semantic-scope-group label:has(input:disabled)` may need to stay as minimal CSS or use Tailwind `has-[:disabled]:opacity-40`

**Test:** Semantic search input + results work, scope radio buttons toggle, person chips select/deselect, analysis items render with correct status colors

### Phase 6: Content Views (Grid, List, Edit Suggestions)

**CSS lines ~1186-1515** (~330 lines): `.empty-state`, `.image-grid`, `.image-card`, `.desktop-list`, `.desktop-list-item`, `.image-edit-suggestions-`*, `.image-edit-row`, `.image-edit-preview-*`, `.desktop-folder-loading`, `@keyframes desktop-loading-spin`, `@media (max-width: 1100px)` responsive breakpoint

**Components affected:**

- `[App.tsx](apps/desktop-media/src/renderer/App.tsx)` (grid/list/empty state rendering)
- Any image edit suggestions component

**Work:**

- Grid layout -> `grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))] p-4`
- List layout -> `flex flex-col gap-2 p-4`
- Image edit row grid with responsive breakpoint -> Tailwind responsive classes
- Loading spinner -> `animate-spin`

**Test:** Grid view renders images, list view renders, empty state displays, loading spinner shows, edit suggestions view works at different widths

### Phase 7: Viewer, Info Panel, Face Cards, Progress Dock, and AI Summary

**CSS lines ~1517-2097** (~580 lines): `.desktop-viewer-`*, `.desktop-info-section`, `.desktop-face-*`, `.desktop-progress-dock`, `.folder-ai-summary-*`

**Components affected:**

- `[DesktopViewerInfoPanel.tsx](apps/desktop-media/src/renderer/components/DesktopViewerInfoPanel.tsx)`
- `[DesktopInfoSection.tsx](apps/desktop-media/src/renderer/components/DesktopInfoSection.tsx)`
- `[DesktopProgressDock.tsx](apps/desktop-media/src/renderer/components/DesktopProgressDock.tsx)`
- `[DesktopFolderAiSummaryView.tsx](apps/desktop-media/src/renderer/components/DesktopFolderAiSummaryView.tsx)`

**Work:**

- Viewer composite layout (60/40 split) -> Tailwind flex
- Info sections (collapsible `<details>`) -> Tailwind with `::-webkit-details-marker` as minimal CSS
- Face cards -> Tailwind (hover/selected states via `hover:` and conditional classes)
- Progress dock (absolute positioning, collapse toggle) -> Tailwind
- AI summary table (sticky header, status badges) -> Tailwind with `sticky top-0` etc.

**Note:** This is the largest phase. Consider splitting into two sub-phases (7a: viewer/info + face cards, 7b: progress dock + AI summary) if it feels too large during implementation.

**Test:** Photo viewer opens with info panel, tabs switch, info sections expand/collapse, face cards highlight on hover/select, progress dock collapses/expands, AI summary table scrolls with sticky header

### Phase 8: Final Cleanup

- Remove all migrated CSS from `styles.css`
- Verify only ~35-50 lines remain (directives, `:root` tokens, any necessary `@keyframes` or pseudo-selectors)
- Run full visual QA across all views
- Ensure no orphaned class names exist in components

**Test:** Full app walkthrough -- every view, every interaction

---

## Risk Mitigation

- **Visual regression:** Each phase is independently testable. After each phase, run the desktop app and verify the affected UI area.
- **Hex color mapping:** Some colors may not have exact theme token equivalents. Use arbitrary Tailwind values `bg-[#hex]` as a bridge, then propose adding custom tokens to the theme if a color is used 3+ times.
- **Complex selectors:** A few CSS patterns (`:has()`, adjacent sibling combinators, `::webkit-details-marker`) may need to remain as minimal CSS. Tailwind 3.4+ supports `has-*:` variants, but verify compatibility.
- `**cn()` utility:** Ensure `apps/desktop-media` has a `cn()` helper (like `clsx` + `tailwind-merge`) for conditional class composition. If not, add one in Phase 1.

