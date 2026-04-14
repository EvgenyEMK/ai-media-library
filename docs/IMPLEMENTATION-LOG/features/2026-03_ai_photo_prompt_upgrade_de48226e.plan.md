---
name: AI Photo Prompt Upgrade
overview: Analyze and upgrade the AI photo-analysis prompt/output contract so rotation and crop can be automatically proposed to users, and add other high-frequency, low-effort corrective suggestions that are easy to automate.
todos:
  - id: align-prompts-web-desktop
    content: Draft prompt v2.2 text and JSON schema updates for both web and desktop prompt files.
    status: pending
  - id: type-contract-update
    content: Add strongly typed edit proposal interfaces to shared PhotoAnalysisOutput contract.
    status: pending
  - id: parser-validation
    content: Implement safe parser validation/coercion for rotation/crop and bounded numeric proposal fields.
    status: pending
  - id: metadata-storage-path
    content: Ensure web metadata save path persists edit proposals as structured optional fields with compatibility fallback.
    status: pending
  - id: docs-and-examples
    content: Update architecture docs and JSON examples with v2.2 output and document-photo examples.
    status: pending
isProject: false
---

# AI Photo Analysis Prompt Upgrade Plan

## What exists today

- Main prompt currently returns generic `edit_suggestions` (e.g., `rotate`, `crop`) without machine-actionable parameters in `[C:/EMK-Dev/emk-website/app/[locale]/media/ai-prompts/photo-analysis-prompts.ts](C:/EMK-Dev/emk-website/app/[locale]/media/ai-prompts/photo-analysis-prompts.ts)`.
- Desktop uses a mirrored prompt in `[C:/EMK-Dev/emk-website/apps/desktop-media/src/shared/photo-analysis-prompt.ts](C:/EMK-Dev/emk-website/apps/desktop-media/src/shared/photo-analysis-prompt.ts)`.
- Parsing/persistence already preserves unknown fields (web + desktop), so richer output can be added with low migration risk in `[C:/EMK-Dev/emk-website/app/[locale]/media/actions/metadata.ts](C:/EMK-Dev/emk-website/app/[locale]/media/actions/metadata.ts)` and `[C:/EMK-Dev/emk-website/apps/desktop-media/electron/photo-analysis.ts](C:/EMK-Dev/emk-website/apps/desktop-media/electron/photo-analysis.ts)`.
- Current UX/docs confirm AI output is underused and mostly non-actionable today (cloud web AI features doc — removed during repo split; desktop AI features are documented in `docs/PRODUCT-FEATURES/AI/`).

## Prompt contract improvements (proposal)

- Introduce a new structured field: `edit_proposals` (keep existing `edit_suggestions` for backward compatibility).
- Add rotation proposal object with explicit operation and confidence:
  - `type: "rotate"`
  - `angle_degrees: 90 | 180 | 270` (clockwise)
  - `confidence: 0..1`
  - `applies_to: "full_image"`
  - `reason`
- Add crop proposal object with relative coordinates for direct app use:
  - `type: "crop"`
  - `target: "document" | "subject" | "horizon_fix" | "other"`
  - `box_rel`: `{ x, y, width, height }` normalized in `[0,1]`
  - Validation constraints in prompt: `x>=0`, `y>=0`, `width>0`, `height>0`, `x+width<=1`, `y+height<=1`
  - `confidence: 0..1`, `reason`
- Add optional `document_quad_rel` for document photos (for perspective correction path later), with 4 normalized corner points in reading order.
- Add `auto_apply_safe` boolean to each proposal so UI can preselect low-risk edits (e.g., 90-degree rotation when confidence is high).

## Additional high-frequency, high-pain, easy-to-automate upgrades

- **Exposure correction** (`type: "exposure_fix"`): add `ev_delta` (suggested exposure compensation range, e.g. `-1.5..+1.5`) for one-click preview.
- **White balance correction** (`type: "white_balance_fix"`): add `temperature_delta` / `tint_delta` (bounded ranges) for preview slider defaults.
- **Straighten/horizon** (`type: "straighten"`): add `horizon_angle_degrees` (small-angle deskew) for auto-straighten preview.
- **Denoise/sharpen intensity** (`type: "denoise"|"sharpen"`): add `strength_0_1` so app can apply deterministic filter intensity.
- **Reject automation for blur/out_of_focus**: keep detection only, because deblur quality is model/tool dependent and often artifact-prone; present as warning, not auto-fix.

## Implementation approach (low-risk, incremental)

1. Bump prompt version to `2.2` in both web and desktop prompt sources and document expected JSON examples.
2. Extend shared type contract (`PhotoAnalysisOutput`) with typed `edit_proposals` in `[C:/EMK-Dev/emk-website/apps/desktop-media/src/shared/ipc.ts](C:/EMK-Dev/emk-website/apps/desktop-media/src/shared/ipc.ts)`.
3. Update desktop parser to validate and coerce proposal payloads (drop invalid boxes/angles safely) in `[C:/EMK-Dev/emk-website/apps/desktop-media/electron/photo-analysis.ts](C:/EMK-Dev/emk-website/apps/desktop-media/electron/photo-analysis.ts)`.
4. Update web metadata typing and persistence to store proposals as first-class optional fields (still preserving unknown extras).
5. Add a lightweight “proposal readiness” validator utility used by both pipelines (rotation angle enum + normalized crop bounds checks).
6. Add documentation and sample JSON for new fields in `[docs/PRODUCT-FEATURES/AI/ai-photo-analysis-prompts.md](docs/PRODUCT-FEATURES/AI/ai-photo-analysis-prompts.md)`.

## Acceptance criteria

- Rotation and crop proposals are machine-actionable without post-hoc NLP parsing.
- All coordinates are relative and validated before persistence/UI use.
- Invalid proposal payloads never break analysis; they are ignored with safe fallback.
- Backward compatibility maintained (`edit_suggestions` still accepted).
- New examples/docs reflect `2.2` schema and include document-photo case.

## Suggested JSON shape (target)

```json
{
  "edit_proposals": [
    {
      "type": "rotate",
      "angle_degrees": 90,
      "confidence": 0.96,
      "auto_apply_safe": true,
      "reason": "Portrait shot stored in landscape orientation"
    },
    {
      "type": "crop",
      "target": "document",
      "box_rel": { "x": 0.08, "y": 0.12, "width": 0.84, "height": 0.76 },
      "confidence": 0.91,
      "auto_apply_safe": true,
      "reason": "Remove table background and isolate receipt"
    }
  ]
}
```

