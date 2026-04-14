# Roadmap: user-defined categories, tags, and AI prompt alignment

**Status:** Product / architecture direction — not implemented.  
**Context:** Today, photo analysis produces a **single** `image_category` (`MediaImageCategory`); quick filters split **Documents**, **People**, and **Categories** (non-document classes). This note captures proven patterns for **hardcoded system categories** vs **user-extensible labels** and optional **multi-tag** semantics.

---

## Goals

1. Keep **stable, code-backed categories** wherever **business logic** depends on them (invoice extraction, document flows, search facets, RBAC).
2. Allow **user preferences**: custom labels injected into the **AI analysis prompt** and surfaced in **filters / UI** without forking the codebase for every vocabulary change.
3. Optionally support **multiple labels per media item** (tags) without collapsing everything into one `image_category`.

---

## What mature DAMs do (UX reference)

- **Lightroom / Capture One:** *Keywords* (often hierarchical, user-defined) sit beside a small set of fixed workflow fields. Users expect keywords to be **many-to-many**, batch-editable, and searchable.
- **digiKam / Excire:** Controlled **tag trees** plus automatic labels; clear separation between “engine suggestion” and “user confirmation.”
- **Enterprise DAM (Picturepark, Celum, etc.):** A **taxonomy service**: system facets + **extensible vocabularies** with permissions, synonyms, and sometimes mapping to IPTC/Getty.

---

## Recommended architecture (high level)

### 1. Split “primary class” from “tags”

- Keep **one** primary `image_category` (or rename to `primary_subject_class`) as the model’s **single best bucket** for coarse navigation and prompts.
- Add **`tags`** (many-to-many table, or ordered JSON with `source: ai | user`). Quick filters and search can use **OR/AND** on tags while the primary field stays the main structured signal.

### 2. Single registry for “allowed labels in the prompt”

- **System slugs** live in code or a **versioned** DB table (`invoice_or_receipt`, `document_other`, …).
- **User extensions** live in another table (`slug`, display name, optional parent, `active`).
- **Build the analysis prompt** by concatenating: system list ∪ approved user list (cap length for model stability).
- **Build filter dropdowns** from the **same** merged list so UI and model stay aligned.

### 3. Avoid one field for two jobs

Using the same field for both **hardcoded pipeline triggers** (invoice OCR, document handling) and **open-ended user vocabulary** creates coupling and painful migrations. Prefer:

- **Fixed enum** (or small set) for **automation triggers**, and  
- **Tags** (or a secondary `content_class`) for flexible UX.

### 4. Versioning and backfill

When the allowed set changes:

- Bump a **`taxonomy_version`** on analysis or per row.
- Plan **re-analysis** or **value mapping** (e.g. retired `travel` → `other` or a new user tag).

### 5. UX patterns

- **Batch apply** tags from grid selection.
- **Suggested vs confirmed**: show AI-suggested tags as chips; user confirms (similar to face confirmation flows).
- **Filter UI**: group **System categories** vs **My tags** to avoid one endless dropdown.

---

## Summary

**Proven approach:** fixed, code-backed categories for **automation and search facets**, plus a **separate extensible tag/taxonomy layer** for user preferences—both fed from a **single source of truth** when generating prompts and building filter UIs.

---

## Related implementation docs

- Quick filters (toolbar): [`AI-SEARCH-DESKTOP.md`](../PRODUCT-FEATURES/AI/AI-SEARCH-DESKTOP.md) §1.2.1  
- Shared filter logic: `lib/media-filters/thumbnail-quick-filters.ts`  
- File star vs AI score: [`FILE-STAR-RATING.md`](../PRODUCT-FEATURES/media-library/FILE-STAR-RATING.md)
