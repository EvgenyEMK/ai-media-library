# AI Photo Analysis Prompts

This document describes the photo analysis prompts used for AI-powered image analysis.

## Overview

The photo analysis system uses configurable prompts stored in TypeScript files. Each prompt can have an associated JSON example file for documentation purposes.

## Prompt Types

### Main Prompt

The **main prompt** (`main`) provides comprehensive photo analysis (prompt version `2.3`) with the following fields:

- `image_category`: Extended categories including `document_contract`, `document_other`, `document_id_or_passport`, `invoice_or_receipt`, plus common visual classes (screenshot, person/people, nature, etc.)
- `title`: Short image title (max 50 characters)
- `description`: Image description (max 500 characters)
- `number_of_people`: Number of people in the image
- `has_child_or_children`: Boolean indicating if one or more children are present
- `people`: Array of person information (category, gender, average age)
- `location`: Country and city
- `date`: Date when photo was taken (YYYY-MM-DD format)
- `time`: Time when photo was taken (HH:MM format)
- `weather`: Weather conditions
- `daytime`: Morning, day, evening, or night
- `photo_estetic_quality`: Quality score from 1-10 (professional photographer perspective)
- `photo_star_rating_1_5`: User-facing quality/value score from 1-5
- `is_low_quality`, `quality_issues`: Top-value quality triage signals
- `edit_suggestions`: Machine-actionable edits including parameters for direct preview/apply
  - `rotate` with orientation-first contract:
    - `rotation.observed_orientation`: `upright | rotated_90_cw | rotated_180 | rotated_270_cw | uncertain`
    - optional `rotation.confidence_orientation` in `[0,1]`
    - optional `rotation.angle_degrees_clockwise` (`90`, `180`, `270`) for backward compatibility
  - `crop` with normalized `crop_rel` (`x`, `y`, `width`, `height`) in `[0,1]`
  - `straighten` with `straighten.angle_degrees` in `[-15, 15]` (metadata capture for future fine-angle alignment)
  - `exposure_fix` with `exposure_fix.ev_delta` in `[-1.5, 1.5]`
  - `white_balance_fix` with `white_balance_fix.temperature_delta` and `white_balance_fix.tint_delta` in `[-100, 100]`
  - `contrast_fix` with `contrast_fix.contrast_delta` in `[-100, 100]`
  - `denoise` / `sharpen` with `strength_0_1` in `[0,1]`

### Fallback Prompt

The **fallback prompt** (`fallback`) is a simplified version used automatically when the main prompt is rejected by the model's content safety guardrail. It uses prompt version `2.3` and requests only:

- `image_category`: Same extended category set as main prompt
- `title`: Short image title (max 50 characters)
- `description`: Image description (max 500 characters)
- `photo_estetic_quality`: Quality score from 1-10

## Automatic Fallback

If the main prompt is rejected by the model guardrail, the system automatically:

1. Logs an error to the console
2. Attempts the fallback prompt
3. Returns results from whichever prompt succeeds

This ensures analysis can still proceed even when the main prompt triggers safety filters.

## Edit Suggestions Contract

`edit_suggestions` is now intended to be consumed by the app directly to pre-render edit previews:

- `confidence` is normalized to `0..1`
- `auto_apply_safe` marks deterministic and low-risk edits
- `rotate` and `crop` are evaluated independently, and when both are needed they should be emitted as separate suggestion objects
- For `crop`, coordinates are relative to the original image dimensions and must satisfy:
  - `x >= 0`, `y >= 0`, `width > 0`, `height > 0`
  - `x + width <= 1`, `y + height <= 1`
- Parser applies small tolerance clamping near `[0,1]` bounds to reduce dropped crop suggestions from minor numeric drift
- Only fields relevant to the specific `edit_type` should be included

## JSON Example Files

The JSON example files (`main-prompt-example.json` and `fallback-prompt-example.json`) are **for documentation purposes only** and are not used in the code. They serve as reference examples of the expected JSON response structure from the AI model.

## Configuration

Prompts are defined in `photo-analysis-prompts.ts` and can be modified to adjust the analysis requirements. The system supports extensible metadata, so new fields can be added to prompts without requiring code changes.

