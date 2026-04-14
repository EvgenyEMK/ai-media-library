---
name: Improve rotate/crop prompts
overview: Harden Photo AI analysis for rotation and crop by redesigning prompt outputs and parser logic, while capturing small-angle horizon-straightening metadata for future use without enabling application yet.
todos:
  - id: update-prompt-contract
    content: Revise prompt schema/instructions to orientation-state output and explicit separate rotate+crop suggestions
    status: pending
  - id: harden-parser
    content: Implement parser normalization for combined edit objects, tolerant crop clamping, and deduplication
    status: pending
  - id: capture-straighten-metadata
    content: Add robust straighten (small-angle horizon) output guidance and parsing for metadata-only storage
    status: pending
  - id: sync-types-docs
    content: Update shared types, JSON examples, and architecture docs to match new contract
    status: pending
  - id: eval-regression
    content: Add a small labeled eval workflow to measure rotate/crop improvements before and after
    status: pending
isProject: false
---

# Improve Rotation And Crop Suggestions

## What I found

- The current prompt asks the model to output `rotation.angle_degrees_clockwise` directly (`90|180|270`) in both desktop and web prompt definitions, which is the exact failure mode you reported for 90 vs 270 confusion: [C:\EMK-Dev\emk-website\apps\desktop-media\src\shared\photo-analysis-prompt.ts](C:\EMK-Dev\emk-website\apps\desktop-media\src\shared\photo-analysis-prompt.ts), [C:\EMK-Dev\emk-website\applocale]\media\ai-prompts\photo-analysis-prompts.ts](C:\EMK-Dev\emk-website\applocale]\media\ai-prompts\photo-analysis-prompts.ts).
- Parser currently accepts only one `edit_type` per object; if model emits a combined rotate+crop object, crop data is discarded (or vice versa): [C:\EMK-Dev\emk-website\apps\desktop-media\electron\photo-analysis.ts](C:\EMK-Dev\emk-website\apps\desktop-media\electron\photo-analysis.ts).
- Crop can also be dropped if values are slightly outside `[0,1]` due to model numeric drift (strict rejection): [C:\EMK-Dev\emk-website\apps\desktop-media\electron\photo-analysis.ts](C:\EMK-Dev\emk-website\apps\desktop-media\electron\photo-analysis.ts).
- External evidence (RotBench) shows MLLMs broadly struggle distinguishing 90° vs 270° in single-pass vision reasoning.
- Current schema already includes `straighten.angle_degrees` (`-15..15`) but prompting/consumption is not optimized for reliable horizon metadata capture.

## Proposed implementation

### 1) Redesign rotation contract to avoid “calculate correction angle” in-model

- Update prompt schema so model reports **observed orientation state** instead of only correction angle.
- Add orientation field for rotate suggestions, e.g.:
  - `rotation.observed_orientation`: `upright | rotated_90_cw | rotated_180 | rotated_270_cw | uncertain`
  - optional `rotation.confidence_orientation`.
- Keep `rotation.angle_degrees_clockwise` as optional backward-compatible field, but derive final correction in code from `observed_orientation`.
- Canonicalize storage/API to clockwise positive `0/90/180/270` (no mixed +/- in persisted output), while parser tolerates model outputs `-90` and maps to `270`.

### 2) Strengthen prompt instructions for rotate + crop as priority edits

- Add a dedicated **Critical actionable checks** section near the top of the prompt:
  - Evaluate rotation and crop independently before any other edit types.
  - If both needed, emit **two separate suggestion objects** (`rotate`, `crop`).
  - Do not omit crop because rotation exists.
  - For crop, prefer conservative but actionable boxes when obvious distractions/margins exist.
- Add explicit “always run these checks” semantics and examples with both rotate+crop present.

### 3) Make parser resilient to common model deviations

- In `parseEditSuggestion`, recover from combined objects by splitting into multiple normalized suggestions when fields for multiple edit types are present.
- Add tolerant crop normalization (small epsilon clamp into `[0,1]`) before rejecting.
- Deduplicate normalized suggestions by `(edit_type, params)` to avoid duplicates.
- Keep strict validation for clearly invalid payloads.

### 4) Capture small-angle horizon alignment metadata (analysis-only)

- Keep actionable rotation limited to `rotate` with `90|180|270` in current UX/apply flow.
- Strengthen `straighten` output contract so the model can report subtle horizon correction separately:
  - `edit_type: "straighten"`
  - `straighten.angle_degrees`: signed float in `[-15, 15]`
  - `reason`: mention the visual anchor (`horizon`, `building verticals`, `waterline`, etc.)
  - `confidence`: required for straighten suggestions.
- Best-practice conventions:
  - Use signed degrees for fine adjustment (`+` clockwise, `-` counterclockwise).
  - Require a minimum absolute threshold in prompt guidance (for example, avoid suggesting `|angle| < 0.5` unless confidence is very high) to reduce noise.
  - Keep rotate and straighten mutually exclusive for one suggestion object; if both are needed, emit separate objects.
- Parse and store straighten metadata now, but do not render/apply it in image-edit actions yet.

### 5) Add evaluation harness and baseline metrics

- Create a small regression set (20-40 images) with labels for:
  - `rotation needed?`, `correct correction angle`, `crop needed?`, `crop roughly valid?`.
- Add a lightweight script/test run to compare before/after precision/recall on rotate and crop.
- Track specifically:
  - 90 vs 270 accuracy,
  - crop recall on images that also require rotation,
  - horizon-straighten suggestion precision (metadata quality only),
  - percentage of dropped suggestions during parsing.

## Files to touch

- Prompt definitions:
  - [C:\EMK-Dev\emk-website\apps\desktop-media\src\shared\photo-analysis-prompt.ts](C:\EMK-Dev\emk-website\apps\desktop-media\src\shared\photo-analysis-prompt.ts)
  - [C:\EMK-Dev\emk-website\applocale]\media\ai-prompts\photo-analysis-prompts.ts](C:\EMK-Dev\emk-website\applocale]\media\ai-prompts\photo-analysis-prompts.ts)
- Parsing and normalization:
  - [C:\EMK-Dev\emk-website\apps\desktop-media\electron\photo-analysis.ts](C:\EMK-Dev\emk-website\apps\desktop-media\electron\photo-analysis.ts)
  - [C:\EMK-Dev\emk-website\apps\desktop-media\src\shared\ipc.ts](C:\EMK-Dev\emk-website\apps\desktop-media\src\shared\ipc.ts)
- Prompt docs/examples:
  - [C:\EMK-Dev\emk-website\docs\project-architecture\ai-photo-analysis-prompts.md](C:\EMK-Dev\emk-website\docs\project-architecture\ai-photo-analysis-prompts.md)
  - [C:\EMK-Dev\emk-website\applocale]\media\ai-prompts\main-prompt-example.json](C:\EMK-Dev\emk-website\applocale]\media\ai-prompts\main-prompt-example.json)

