---
name: Fix photo AI warmup + cancel edge cases
overview: Stabilize desktop-media Image AI analysis startup behavior, improve warmup UX, and fix cancel edge cases that could leave UI stuck in running state.
isProject: false
---

# Fix Image AI Analysis Warmup and Cancel Reliability

## User-facing fixes

- Add a dedicated warmup phase for Image AI analysis and show explicit progress text in Background operations:
  - `Loading AI model - it may take 1-2min`
- Prevent initial "first batch failed" pattern by warming up Qwen/Ollama before workers process real images.
- Make cancel robust when triggered:
  - before `jobId` is known in renderer
  - during warmup (before any worker controller exists)
  - after main has already finalized the job (cancel returns false)
- Ensure folder thumbnails remain responsive after cancel by exiting workers quickly instead of iterating the whole remaining queue.
- Ensure right-click folder menu no longer gets stuck showing Image AI analysis as running after warmup-cancel.

## Technical notes

- Added photo-analysis phase events (`initializing-model`, `analyzing`) via shared IPC contract.
- Added warmup cancellation completion path that emits `job-completed` for warmup-cancelled jobs.
- Added targeted Ollama retry logic for transient errors (`unexpected EOF`, sequence creation failures, 5xx/fetch reachability issues).
- Added optional troubleshooting logs gated behind `EMK_DEBUG_PHOTO_AI=1`.

## Verification

- Added/updated desktop-media E2E tests:
  - `photo-analysis-readiness.spec.ts`
  - `photo-analysis-cancel.spec.ts`
  - `photo-analysis-warmup-cancel.spec.ts`
- Confirmed targeted photo-analysis E2E suite passes after fixes.

