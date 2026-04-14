---
name: Invoice Data Extraction
overview: Implement conditional second-pass invoice data extraction for both desktop and web AI photo pipelines, store it as top-level `document_data`, and add desktop settings controls/prompts for this feature.
todos:
  - id: add-invoice-prompt-contract
    content: Add invoice extraction prompt/constants and `document_data` typing in shared metadata/interfaces
    status: completed
  - id: desktop-pipeline-second-pass
    content: Implement desktop conditional second-pass invoice extraction and attach `document_data`
    status: completed
  - id: web-pipeline-second-pass
    content: Implement web conditional second-pass invoice extraction and pass merged payload to metadata saver
    status: completed
  - id: desktop-settings-plumbing
    content: Add `extractInvoiceData` setting across IPC defaults/sanitization/persistence and analyze request payload
    status: completed
  - id: desktop-settings-ui
    content: Rename section to Image analysis, add checkbox, and show read-only invoice extraction prompt
    status: completed
  - id: validate-and-regression-check
    content: Run targeted checks and verify non-invoice/invoice + toggle behaviors
    status: completed
isProject: false
---

# Add invoice `document_data` extraction

## Scope and behavior

- Trigger invoice extraction only when first analysis resolves `image_category === "invoice_or_receipt"`.
- Store extraction result as top-level `document_data` in metadata (same level as `ai` and `people`) for both desktop and web.
- Desktop-only setting toggle `Extract invoice data` defaults to enabled and controls whether the second prompt runs.

## 1) Add shared invoice extraction prompt + data contract

- Extend desktop shared prompt module `[apps/desktop-media/src/shared/photo-analysis-prompt.ts](apps/desktop-media/src/shared/photo-analysis-prompt.ts)`:
  - Add `INVOICE_DATA_EXTRACTION_PROMPT` (read-only text for Settings UI).
  - Optionally add `INVOICE_DATA_EXTRACTION_PROMPT_VERSION` for traceability.
- Extend web prompt registry `[app/[locale]/media/ai-prompts/photo-analysis-prompts.ts](app/[locale]/media/ai-prompts/photo-analysis-prompts.ts)`:
  - Add prompt config for invoice extraction (new id, e.g. `invoice-data`).
- Add/extend type(s) for top-level invoice payload:
  - `[app/types/media-metadata.ts](app/types/media-metadata.ts)` add optional `document_data` object on `MediaMetadataV2`.
  - `[apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts)` add optional `document_data` on `PhotoAnalysisOutput` for stronger typing.

## 2) Desktop pipeline: run second VLM call and attach `document_data`

- In `[apps/desktop-media/electron/photo-analysis.ts](apps/desktop-media/electron/photo-analysis.ts)`:
  - Refactor VLM call helper to support custom prompt content (reuse same model/options/timeout flow).
  - Add helper to run invoice extraction prompt and parse JSON object safely.
- In `[apps/desktop-media/electron/photo-analysis-pipeline.ts](apps/desktop-media/electron/photo-analysis-pipeline.ts)`:
  - Add `extractInvoiceData` param to `AnalyzePhotoWithOptionalTwoPassParams`.
  - After final base analysis is produced, if category is `invoice_or_receipt` and flag enabled, run invoice extractor and merge into output as `document_data`.
- In `[apps/desktop-media/electron/ipc/photo-analysis-handlers.ts](apps/desktop-media/electron/ipc/photo-analysis-handlers.ts)`:
  - Read request override / settings fallback for `extractInvoiceData`.
  - Pass it into `runPhotoAnalysisJob` and then into `analyzePhotoWithOptionalTwoPass`.
- In `[apps/desktop-media/electron/db/media-analysis.ts](apps/desktop-media/electron/db/media-analysis.ts)`:
  - Ensure `document_data` is preserved in top-level extras when saving merged metadata (existing extras merge already supports this; verify no known-field exclusion blocks it).

## 3) Web pipeline: run second Gemini prompt and persist `document_data`

- In `[app/[locale]/media/actions/analyze-photo-ai.ts](app/[locale]/media/actions/analyze-photo-ai.ts)`:
  - Parse first-pass JSON response.
  - If `image_category` is `invoice_or_receipt`, run second prompt via Gemini and merge result as `document_data` into the payload passed to metadata save.
  - Keep guardrail/fallback behavior consistent with existing analysis flow.
- In `[app/[locale]/media/actions/metadata.ts](app/[locale]/media/actions/metadata.ts)`:
  - Confirm/save `document_data` as top-level extra metadata (already supported via unknown-field merge); add explicit handling only if needed for stricter typing/validation.

## 4) Desktop Settings updates

- In `[apps/desktop-media/src/shared/ipc.ts](apps/desktop-media/src/shared/ipc.ts)`:
  - Add `extractInvoiceData: boolean` to `PhotoAnalysisSettings` + default `true` in `DEFAULT_PHOTO_ANALYSIS_SETTINGS`.
  - Add optional `extractInvoiceData` to `AnalyzeFolderPhotosRequest`.
- In `[apps/desktop-media/electron/storage.ts](apps/desktop-media/electron/storage.ts)`:
  - Sanitize/persist the new setting with default fallback `true`.
- In `[apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts](apps/desktop-media/src/renderer/hooks/useDesktopIpcBindings.ts)`:
  - Include `extractInvoiceData` in settings change detection for persistence.
  - Also include `useFaceFeaturesForRotation` in the compare list (existing omission) so all toggles persist consistently.
- In `[apps/desktop-media/src/renderer/App.tsx](apps/desktop-media/src/renderer/App.tsx)`:
  - Pass `useFaceFeaturesForRotation` and `extractInvoiceData` in `analyzeFolderPhotos` request.
- In `[apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx](apps/desktop-media/src/renderer/components/DesktopSettingsSection.tsx)`:
  - Rename section title `Photo analysis` -> `Image analysis`.
  - Add checkbox `Extract invoice data` (checked by default).
  - Add read-only prompt block showing invoice extraction prompt text (similar to existing main prompt block).

## 5) Validation

- Run desktop typecheck/tests (including settings e2e smoke where available) and web typecheck/lint on touched areas.
- Manually verify:
  - Invoice image with toggle ON produces top-level `document_data`.
  - Invoice image with toggle OFF skips extraction.
  - Non-invoice image never runs second extraction.
  - Settings label rename and read-only prompt display are correct.

