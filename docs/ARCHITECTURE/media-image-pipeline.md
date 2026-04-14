# Media Image Handling Plan

## Phase Status Overview
- **Phase 1 – Client-side thumbnail creation and album grid integration** — Status: ✅ Completed
- **Phase 2 – Lazy loading & viewport-aware fetching** — Status: ✅ Completed
- **Phase 3 – Server-side processing & metadata hardening** — Status: Potential Future Enhancements

---

## Phase 1 – Client-side thumbnail creation and album grid integration (Completed)
- Extend upload flows to generate a small thumbnail in the browser (Canvas/OffscreenCanvas) before sending files.
- Upload both the original asset and the generated thumbnail to Supabase Storage using a consistent naming convention (e.g. append `thumb_sm` in the same folder).
- Persist thumbnail references in the database (temporary shortcut: infer the thumbnail path if schema changes are deferred).
- Update album grid components to request and render thumbnail URLs with graceful fallback to original.
- Provide UX feedback for thumbnail generation errors, keeping uploads resilient.

## Phase 2 – Lazy loading & viewport-aware fetching (Completed)
- Implement intersection-observer based lazy loading for grid rows and virtualized thumbnail strips.
- Prefetch the next asset’s medium variant when a user pauses on a photo in the viewer.
- Centralize helpers that resolve URLs for `thumb`, `medium`, `original` to simplify future server-generated variants.
- Ensure keyboard/screen-reader navigation works as items mount/unmount dynamically.

## Phase 3 – Server-side processing & metadata hardening (Potential Future Enhancements)
- Introduce Supabase Edge Functions or queued workers to create thumbnails and video posters server-side.
- Expand database schema with `processing_status`, `media_variants`, and richer metadata for auditing.
- Allow reprocessing/backfill of legacy assets and expose admin tools to monitor failures.
- Add support for additional derivative formats (WebP/AVIF, medium/large sizes) and caching policies.

---

## Operational Notes
- Keep upload API contracts flexible so server-side processing can replace client-side thumbnail creation later.
- Use consistent storage paths and metadata so future automation can detect and regenerate variants safely.
- Document any temporary shortcuts in PR descriptions to ease refactors in later phases.

