# AI image search (desktop-media)

## Scope

This document describes **product UX** and **business logic** for AI-powered image search in the **desktop** media app (`apps/desktop-media`). It applies to local SQLite catalogs and on-device embedding models (Nomic multimodal stack), not to the web Supabase media app.

Related UX docs:

- [App Settings (desktop)](../media-library/APP-SETTINGS-UX.md) — **AI image search** thresholds and other desktop settings.
- [Folder analytics menu](../media-library/FOLDER-ANALYTICS-MENU-UX.md) — how indexing and the temporary description-embedding action are started from the UI.
- [Bottom app panel](../media-library/BOTTOM-APP-PANEL-UX.md) — background progress cards, including AI search indexing and description embedding backfill.
- [Unconfirmed face search](./UNCONFIRMED-FACE-SEARCH.md) — person-tag filter behavior in the AI search panel.
- [People / face tags](./PEOPLE-FACE-TAGS.md) — person tags, Tagged faces, and shared chip UX patterns.
- [File star rating](../media-library/FILE-STAR-RATING.md) — catalog **Rating** vs AI **AI Rating** in quick filters.
- [Media item tags / taxonomy roadmap](../../ROADMAP/media-item-tags.md) — future user-defined categories and multi-tag direction (not implemented).

---

## 1) User experience

### 1.1 Opening search

The user opens **AI image search** from the main toolbar (search affordance). The panel combines a text query, **scope**, **Advanced search**, optional **person tag** filters, and (when tags are selected) **include unconfirmed similar faces**.

### 1.2 Panel layout and filters

Controls are grouped deliberately so scope stays separate from optional query enhancement:

| Row / area | Contents |
|------------|----------|
| **Query** | Single line: text field (Enter submits when non-empty), **Search**, **Clear results** (disabled when there are no results). |
| **Scope & advanced** | One row: **Scope** radio group (**Global** / **Selected folder** / **Selected folder with sub-folders**), **vertical divider**, **Advanced search** checkbox, optional second divider and **Matching method** `<select>` (**VLM + Description** / **VLM only** / **Description only**) when **Show matching method selector in search filters** is on in App settings (see §2.3). Folder-scoped radios stay disabled until a folder is selected. |
| **Person tags** | When the library has person tags: a **Person tags** section aligned with **People → Tagged faces**. Inline **Name** filter (search icon, clear control, fixed-width field), optional **Show all** / **Hide all** when the collapsed chip list omits tags, then **tag chips** in the same wrapping row. **Unlike Tagged faces**, the user may **select multiple** person tags; selected tags stay visible when the list is collapsed. **Search semantics:** multiple selected tags combine with **AND**—a photo must match every selected person (see §2.1). Visibility rules (pinned first, recent non-pinned, top by tagged-face count) and name filtering share the same logic as the Tagged faces tab (`getSemanticSearchVisiblePersonTagIds` / shared helpers in `tagged-faces-tab-visible-tags.ts`). Tags are loaded with face counts via `listPersonTagsWithFaceCounts` so ordering matches People. |
| **Unconfirmed faces** | When **at least one** person tag is selected, **Include unconfirmed similar faces** appears below. **Default: on** (store initial state). See [Unconfirmed face search](./UNCONFIRMED-FACE-SEARCH.md). |

### 1.2.1 Quick filters (toolbar, not inside the search panel)

The main toolbar **Quick filters** menu applies **after** the current view is determined: **folder thumbnails** or **AI image search results** (post similarity / RRF). Shared logic: `matchesThumbnailQuickFilters` in `lib/media-filters/thumbnail-quick-filters.ts`. Dimensions include **People**, **Documents**, **Rating** (catalog star), **AI Rating** (`photo_estetic_quality` → 1–5), and **Categories** (single `image_category`). **Categories** lists only **non-document** visual classes (`architecture`, `food`, `humor`, `nature`, `other`, `pet`, `sports`). All **document-like** `image_category` values (invoices, IDs, contracts, screenshots, slides, diagrams, generic other-document bucket, etc.) belong under **Documents**, not **Categories**. **`person_or_people`** uses **People**; **`invoice_or_receipt`** uses **Documents**. **`document`** and **`travel`** are not valid model outputs (use `document_other` and a more specific class). **Future:** the same filter state could additionally gate candidates **before** embedding similarity (similar to person-tag prefiltering today).

Status text (e.g. searching message or result count) and panel close remain in the panel header.

### 1.3 What the user should expect from results

**Default (Advanced search off)**  
Results are ordered by a **fused relevance score** that combines several signals (see §2). In practice:

- Images that **literally** mention query words in their AI-generated title or description can rank higher than with vision-only search.
- Images whose **semantic** content matches the query (vision embedding) still contribute strongly.
- Images whose **stored description embedding** aligns with the query text can surface even when the raw keyword match is weak.

Exact ordering is not guaranteed to match any single signal; the goal is robust ranking across “looks like” and “says so in text.”

**Advanced search (checkbox next to Scope, after a visual divider)**  
When enabled in the **search panel**, the app runs a **local LLM** (via Ollama, with configured fallbacks) to normalize the query—typically producing English text plus a small list of **keywords** extracted from the intent. When analysis succeeds, the **English/normalized query** string is embedded for retrieval (same pipeline as described in §2.1).

**Keyword-based re-ranking** is **not** implied by Advanced search alone. In **App settings → AI image search**, **Advanced search — Keyword match reranking** must be **on** (default is **off**). When it is off, results stay in **RRF order** even if the LLM returned keywords.

When reranking is **on** (and the LLM returned at least one keyword, and **at least one** keyword hit threshold is &gt; 0 — see §2.3.1):

- Result ordering **prioritizes images with more keyword “hits”** (concepts that pass per-modality floors), then **breaks ties** using the **raw RRF score** (no multiplicative boost on score).
- Keyword hit floors are **absolute** settings (**Keyword match threshold — VLM** and **— AI Description**), not derived from the grid visibility thresholds.

**Keyword hit** (re-rank step only): for each LLM keyword, the keyword embedding (same `search_query:` text embedding as the main query) is compared to the image’s **cached VLM embedding** and **cached AI-description text embedding** when each exists. A modality counts toward a hit only if its **keyword threshold** in Settings is **&gt; 0** and cosine similarity meets that floor. In **hybrid** matching mode, a keyword counts as a hit if **either** active modality passes (**OR**). **0** on one modality means “don’t use that limb for keyword hits.”

Full-text **BM25** runs in parallel for diagnostics; it is **not** merged into RRF.

**Matching method** (optional control in the panel when enabled in Settings): **VLM + Description** uses RRF over both rank lists; **VLM only** / **Description only** use a single list for fusion. The **grid visibility gate** respects the same mode (hybrid uses OR across VLM + description floors; single-signal modes use only that signal) so ranking and “what stays visible” stay aligned for comparison tests.

### 1.4 Prerequisites (data the app must have)

| Capability | User-visible preparation |
|------------|---------------------------|
| **Vision similarity** | Run **Index images for AI search** for the relevant folders (creates **image** embeddings for the configured multimodal model). |
| **Keyword matching** | Run **Photo AI analysis** so items have AI **title** and **description** stored; the app maintains an FTS5 full-text index from that text. |
| **Description-embedding similarity** | **New analyses**: after each successful photo analysis, the app embeds title+description as a **text** document vector. **Existing libraries**: use the temporary **AI description embedding** action (folder menu) once to backfill missing text embeddings (see [Folder analytics menu](../media-library/FOLDER-ANALYTICS-MENU-UX.md) §9). |
| **Advanced search (query + keywords)** | **Ollama** running locally with a configured vision-language model (and optional fallbacks as implemented). If Ollama is unavailable or analysis fails, search behaves like **Advanced search off**. |

If a signal has no data for an image (e.g. no analysis text), that signal simply does not vote for that item; other signals can still return it.

### 1.5 Temporary: “AI description embedding” (migration)

A dedicated menu row (not the same expandable pattern as face / photo / vision index) runs a **folder-scoped backfill**: recursive under the chosen folder, **only** for images that already have AI metadata but **do not** yet have a description **text** embedding for the current model. It shows progress in **Background operations** and can be cancelled. It **does not** change **Folder AI analysis summary** coverage columns. This entry is intended to be removed after libraries are migrated.

---

## 2) Business logic (search pipeline)

### 2.1 Query processing

1. If **Advanced search** is enabled, the app may call **query understanding** first: the user text is sent to a local LLM, which returns structured fields such as English query text and **keywords**. When that succeeds, the **English/normalized query** string is what gets embedded for retrieval; otherwise the raw user text is embedded as today.
2. The chosen query string is embedded with the **text** embedding model using the **`search_query:`** task prefix (asymmetric retrieval: query side of the Nomic embed space).
3. Optional filters (folder path, recursion, **one or more** person tags, **include unconfirmed similar faces** when `includeUnconfirmedFaces === true` on the IPC request) restrict which media rows are eligible. Person-tag IDs are sent as an array; SQL applies **AND** semantics—**each** selected tag must be satisfied on the same media item (confirmed face and/or suggestion row when unconfirmed is enabled). Default UI state includes unconfirmed matches when tags are used unless the user turns the checkbox off (`semanticIncludeUnconfirmedFaces` in `@emk/media-store` defaults to `true`).

### 2.2 Parallel retrieval signals

For each search, the app runs **in parallel**:

1. **Vision vector search** — cosine similarity between the query embedding and stored **image** embeddings (same model family, query prefix vs image pipeline as implemented in code).
2. **Keyword search (BM25-style via SQLite FTS5)** — full-text search over indexed AI title/description content for the same filtered corpus. FTS query construction follows the app’s rules (e.g. tokenization and operators as implemented in `keyword-search`).

3. **Description vector search** — cosine similarity between the **same query embedding** and stored **text** embeddings that were produced from AI title+description using the **`search_document:`** prefix (document side of the asymmetric pair).

Items that already have a text embedding are skipped on backfill and on incremental analysis saves only upsert when analysis completes.

### 2.3 Rank fusion

Each signal returns an ordered list of candidates (with ranks). The app merges **vision vector** ranks and **description-vector** ranks with **Reciprocal Rank Fusion (RRF)**—either **both** lists (**hybrid**) or **one** list when **Matching method** is restricted to a single signal (see IPC `signalMode`). Items that appear high in **both** lists gain a boost relative to items that only score well on one signal. A configurable depth/limit caps work and result size.

The **FTS keyword** (BM25) leg runs in parallel for logging and optional diagnostics; it is **not** included in the RRF inputs.

### 2.3.1 Advanced search: keyword re-rank (after RRF)

Re-ranking runs only when **all** of the following hold:

1. **Advanced search** is checked in the **search panel** (IPC `advancedSearch`).
2. Query analysis returns at least one **keyword**.
3. **App settings**: **Advanced search — Keyword match reranking** is **on** (`keywordMatchReranking`).
4. **At least one** of **Keyword match threshold — VLM** or **— AI Description** is **&gt; 0** (if both are **0**, re-ranking is skipped).

Then:

1. Each keyword is embedded with the **query** task prefix (`search_query:`).
2. For each fused result row, cosine similarity is computed against cached **VLM** and **AI description** embeddings when present.
3. **Per-modality floors** are the two **keyword** thresholds from Settings (absolute values, defaults **0.05** VLM and **0.5** description). If a threshold is **0**, that modality does **not** participate in hit detection for keywords.
4. **Hit rule (hybrid matching):** a keyword is a hit if the **VLM** limb passes (when enabled) **or** the **description** limb passes (when enabled), consistent with `hitSignalMode` when the user chose VLM-only or description-only matching for search.
5. **Coverage** is still computed for logging/diagnostics (average of credited similarities per keyword over the keyword count).
6. **Sort:** descending **`keywordHits`**, then descending **RRF** **`score`** (the fused score is **not** multiplied by coverage).

Requires **Ollama** (and a configured vision-language chat model) for query analysis; if analysis fails, search falls back to embedding the raw query and **no** keyword re-rank runs.

### 2.4 Post-fusion behavior

After fusion (and optional keyword re-rank), existing product logic still applies where implemented (for example, annotation when person-tag filters are used). This document does not duplicate every filter edge case; see code and [Unconfirmed face search](./UNCONFIRMED-FACE-SEARCH.md) for person-tag nuances.

### 2.5 Full-text index maintenance

- **On write**: when photo analysis results are saved, the AI description (and related searchable text as implemented) is updated in the FTS5 shadow table.
- **On upgrade**: a migration backfills FTS from existing `ai_metadata` where applicable.

### 2.6 Model and storage

- Embeddings and metadata live in the **local SQLite** database and associated vector storage adapter for the desktop app (no separate vector-only database product requirement for this feature).
- **Image** and **text** embedding rows are distinguished by type/source fields so vision indexing jobs do not overwrite description embeddings and vice versa.

---

## 3) Operational notes (non-UX)

- Search latency grows with corpus size for flat scans; large libraries may need future ANN or indexing improvements—the current architecture favors correctness and simplicity on desktop.
- Logs in the main process may include diagnostic counts per signal (e.g. how many candidates each leg returned) for tuning.

---

## 4) Code map (for maintainers)

| Concern | Primary location |
|--------|------------------|
| IPC: search, indexing, description backfill | `apps/desktop-media/electron/ipc/semantic-search-handlers.ts` |
| Advanced search: LLM query analysis (Ollama) | `apps/desktop-media/electron/query-understanding.ts` |
| Advanced search: keyword re-rank (VLM + description hits) | `apps/desktop-media/electron/db/keyword-reranker.ts` |
| Hybrid fusion | `apps/desktop-media/electron/db/search-fusion.ts` |
| FTS5 keyword search | `apps/desktop-media/electron/db/keyword-search.ts` |
| Vector search (image + description text) | `apps/desktop-media/electron/db/semantic-search.ts` |
| Document vs query text embedding | `apps/desktop-media/electron/nomic-vision-embedder.ts` |
| Photo analysis prompt (description length/detail) | `apps/desktop-media/src/shared/photo-analysis-prompt.ts` |
| Renderer: AI search panel (layout, scope, advanced, person tags, unconfirmed) | `SemanticSearchPanel.tsx`, `semantic-search-person-tags-bar.tsx`, `people-tags-name-search-header.tsx`, `App.tsx` |
| Renderer: person-tag chip visibility (Tagged faces parity, multi-select) | `lib/tagged-faces-tab-visible-tags.ts` |
| Store: semantic query, scope, advanced, person tag IDs, unconfirmed default | `packages/media-store/src/slices/semantic-search.ts` |
| Renderer: progress + menu | `App.tsx`, `FolderAnalysisMenuSection.tsx`, `DesktopProgressDock.tsx` |
