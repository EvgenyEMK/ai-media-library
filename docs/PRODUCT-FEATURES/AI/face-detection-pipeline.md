# Face Detection Pipeline Baseline

## Quick Reference

```tsx
// Client-side (MediaPipe)
import { detectFaceBoundingBoxes } from '@/app/[locale]/media/utils/face-detection';

const faces = await detectFaceBoundingBoxes(imageUrl);
```

```ts
// Server-side (Azure / Google)
import { detectFacesWithCloudProviders } from '@/app/[locale]/media/actions/cloud-face-detection';

await detectFacesWithCloudProviders(mediaItemId, { providerOrder: ['azure-face'] });
```

## Overview

The face tagging experience relies on a hybrid client/server workflow:

1. **Image loading on the client** – components such as `PhotoWithInfoPanel` and the batch processor use the media item's `storage_url`/`thumbnail_url` to load the image into an `HTMLImageElement` in the browser so we can access its intrinsic `width`/`height`.
2. **Local MediaPipe inference** – `app/[locale]/media/utils/face-detection.ts` wraps the MediaPipe Tasks Vision `FaceDetector`. It keeps a singleton detector instance, supports the short/full range models, and returns pixel-space bounding boxes (`mp_x`, `mp_y`, `mp_width`, `mp_height`) plus a score.
3. **Server orchestration** – `app/[locale]/media/actions/cloud-face-detection.ts` loads the configured provider order (`FACE_DETECTION_PROVIDER_ORDER`), registers Azure and Google providers, and calls `runFaceDetection` with automatic retries and latency tracking. If every server provider fails and `FACE_DETECTION_ALLOW_CLIENT_FALLBACK` is `true`, the action signals the client to run MediaPipe instead.
4. **Client batching & fallback** – `app/[locale]/media/utils/batch-face-detection.ts` now calls `detectFacesWithCloudProviders` first; only when the response sets `requiresClientInference` does it fall back to MediaPipe inference and `saveFaceDetectionResults`.
5. **Server-side persistence** – `app/[locale]/media/actions/detect-faces.ts` exposes `saveDetectedFaces`, which converts provider payloads into canonical `BeingBoundingBox[]` entries. Every stored face box now uses normalized coordinates (`x_min`, `y_min`, `x_max`, `y_max` within a 0–1000 range) alongside the source image dimensions, while the provider’s raw rectangle is preserved separately for debugging. The helper records `face_detection_method` as `'mediapipe' | 'azure-face' | 'google-vision'`.
6. **Supabase data contracts** – `lib/db/media-face-tags.ts` continues to manage `media_face_instances`, tag assignments, and cleanup. Face rectangles inside metadata are canonical; provider-specific fields (e.g. MediaPipe pixel coordinates) are only kept in the optional `provider_raw_bounding_box` payload for traceability.
7. **UI consumption** – Components under `app/[locale]/media/components/PhotoWithInfoPanel/` merge `mediaItem.face_instances` with `ai_metadata.people_bounding_boxes`. The “Detect faces” CTA uses the cloud action first, falling back to MediaPipe transparently for administrators.

## Key Data Shapes

- `MediaPipeFaceResult` (client inference) → `{ mp_x, mp_y, mp_width, mp_height, score }`
- `BeingBoundingBox` in metadata → `{ person_face_bounding_box: BoundingBox, provider_raw_bounding_box: { provider_id, format, box } }` where `BoundingBox` stores canonical normalized coordinates (`x_min`, `y_min`, `x_max`, `y_max`) plus optional pixel dimensions derived from the original image size.
- `MediaFaceInstance` rows → `{ face_index, bounding_box: FaceBoundingBox, type, confidence }` with optional tag linkage and training flags.

## Current Limitations

- Azure/Google providers rely on signed URLs (`storage_url`/`thumbnail_url`); when these URLs are inaccessible to the cloud service we still fall back to client-side MediaPipe.
- Bounding box metadata continues to track face-level rectangles only; provider-specific attributes (emotion scores, masks, head pose, etc.) are stored in `providerPayload` but are not rendered in the UI yet.
- Latency and cost metrics are logged per response but no persistent telemetry dashboards exist yet.
- Batch workflows still run in the browser; we do not yet have a background job that invokes the orchestration action for offline processing.

## Implications for Cloud Providers

Any additional provider must:

- Produce bounding boxes compatible with `BeingBoundingBox` (`person_face_bounding_box` preferred) and `FaceBoundingBox`.
- Populate `face_detection_method` plus optional `ai_model_version` so downstream analytics can filter by provider.
- Integrate with `saveDetectedFaces` to keep tag-management flows (`assignPersonTagToFaceAction`, `clearPersonTagFromFaceAction`, etc.) unchanged.
- Respect the routing contract by implementing `FaceDetectionProvider.detect` and registering via `registerDefaultFaceDetectionProviders` or a feature-specific initializer.


