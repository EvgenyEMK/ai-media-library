---
name: AI search keyword settings and reranking
overview: |
  Original plan introduced keyword re-rank tuning and RRF-only tie-breaks.
  As implemented in the repo (iterations after this file was first drafted): absolute per-modality keyword hit
  thresholds, a Settings toggle for keyword match reranking, optional “Matching method” in the search panel
  (settings-gated), and sort order keywordHits then raw RRF score (no multiplicative score boost).
  See docs/PRODUCT-FEATURES/AI/AI-SEARCH-DESKTOP.md for authoritative product behavior.
todos: []
isProject: true
---

# AI image search — keyword reranking and settings (evolution)

This document records the **planning arc** and **where the implementation landed**. Product UX and business logic are maintained in [AI-SEARCH-DESKTOP.md](../PRODUCT-FEATURES/AI/AI-SEARCH-DESKTOP.md).

## As implemented (summary)

### Settings (`AiImageSearchSettings`)

- **VLM (visual) similarity threshold** / **AI description similarity threshold** — grid **visibility** OR-gate (unchanged conceptually).
- **Advanced search — Translate search prompt to English if needed** — informational only (always shown on); documents that the Advanced search panel path uses LLM output for `english_query` when embedding.
- **Advanced search — Keyword match reranking** — default **off**. When off, keyword threshold fields are **inactive** in the UI and keyword re-ranking **never** runs (even if Advanced search is on and keywords exist).
- **Keyword match threshold — VLM** / **AI Description** — absolute cosine floors for keyword **hits** (defaults **0.05** and **0.5**). Used only when reranking is on. **0** = that modality does not count toward keyword hits. If **both** are 0, reranking is skipped.
- **Show matching method selector in search filters** — default off. When on, the search panel exposes **Matching method** (hybrid / VLM only / description only) for ranking and visibility experiments.

### Search pipeline

1. **RRF** fuses **vision vector** ranks and **description vector** ranks (FTS/BM25 runs in parallel for diagnostics, **not** in RRF).
2. **Keyword re-rank** (optional): after RRF, reorder by **keyword hit count** descending, then **RRF score** descending. Row `score` remains the fused RRF value (no `× (1 + α × coverage)` boost).

### Code map

| Concern | Location |
|--------|----------|
| IPC + defaults | `apps/desktop-media/src/shared/ipc.ts` |
| Search handler | `apps/desktop-media/electron/ipc/semantic-search-handlers.ts` |
| Keyword re-rank | `apps/desktop-media/electron/db/keyword-reranker.ts` |
| Settings UI | `apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx` |
| Search panel | `apps/desktop-media/src/renderer/components/SemanticSearchPanel.tsx` |
| Shared number field `disabled` | `packages/media-viewer/src/settings-controls.tsx` |

## Original plan notes (historical)

Early drafts used a single **multiplier add-on** on grid thresholds; this was replaced by **two absolute keyword thresholds**, then a dedicated **Keyword match reranking** checkbox so **zero thresholds** mean “inactive modality,” not “disable reranking globally.”
