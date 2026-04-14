# Media Face Tags & AI Recognition

This document outlines a three-phase implementation plan to support person tagging, face-recognition training datasets, and external AI model integration for media items.

## Goals

- Provide a canonical tagging system for people and other future tag types.
- Allow users to assign person tags to detected faces, with manual overrides and new-tag creation.
- Prepare curated training datasets and integrate with external face-recognition APIs (Azure Face ID as baseline).
- Preserve compatibility with existing face detection metadata while adding richer structures for manual and automated workflows.

## Data Model Strategy

### Decision: Generic Tags Table with Person Specialization

- **Why**: Future phases call for additional tag categories (locations, themes). A single `media_tags` table with a `tag_type` dimension keeps search/filter consistent.
- **Person-specific metadata**: Use a companion table (`media_person_profiles`) for attributes unique to people (preferred display name, alternate names, training thresholds, optional avatar).
- **Linkages**: Introduce join tables for:
  - `media_item_tags` (media item ↔ tag, no face box).
  - `media_face_instances` (detected face ↔ tag, references bounding box metadata).
- **Compatibility**: Replace the legacy `media_item_subject_tags` table with the new face-instance model. The existing table is unused and can be removed during the migration.

### Proposed Tables & Columns

- `media_tags`
  - `id UUID PK`
  - `tag_type ENUM('person','pet','theme','location',...)`
  - `label TEXT` (display value)
  - `normalized_label TEXT` (lowercase slug for search)
  - `description TEXT NULL`
  - `created_by UUID` / timestamps
  - Unique index on `(normalized_label, tag_type)`

- `media_person_profiles`
  - `tag_id UUID PK REFERENCES media_tags(id)`
  - `primary_email TEXT NULL`
  - `aliases TEXT[] NULL`
  - `notes TEXT NULL`
  - `training_threshold SMALLINT NULL` (minimum face samples)
  - `auth_user_id UUID NULL` (optional link to authenticated user; many profiles will not have an auth record)
  - `created_at/updated_at`

- `media_item_tags`
  - `id UUID PK`
  - `media_item_id UUID REFERENCES media_items(id)`
  - `tag_id UUID REFERENCES media_tags(id)`
  - `tag_type` (cached for fast filtering)
  - `source ENUM('manual','auto')`
  - `confidence NUMERIC NULL`
  - `created_by UUID`
  - Unique index `(media_item_id, tag_id)`

- `media_face_instances`
  - `id UUID PK`
  - `media_item_id UUID`
  - `face_index INT` (position in metadata array; fallback for manual entries)
  - `bounding_box JSONB` (rect in pixel coordinates)
  - `image_width INT`, `image_height INT` (dimensions used for detection, optional)
  - `tag_id UUID NULL` (link to `media_tags` if identified)
  - `type ENUM('manual','auto','imported','false_positive')`
  - `confidence NUMERIC NULL`
  - `training_candidate BOOLEAN DEFAULT false`
  - `ai_model_version TEXT NULL`
  - `created_by UUID`

- `media_model_training_jobs`
  - `id UUID PK`
  - `tag_id UUID` (person)
  - `provider ENUM('azure_face','amazon_rekognition',...)`
  - `status ENUM('pending','preparing','uploading','training','completed','failed')`
  - `payload JSONB` (request metadata, dataset manifest)
  - `result JSONB` (model identifiers, metrics)
  - `created_by`, timestamps

### Migration Considerations

- Phase 1 migration adds `media_tags`, `media_person_profiles`, `media_item_tags`, `media_face_instances`.
- Drop the deprecated `media_item_subject_tags` table within the same migration.
- Build Supabase RLS policies mirroring `media_items` access rules.

## Phase 1 – Person Tagging for Detected Faces

### Backend

- **Supabase migrations**
  - Create new tables/indexes listed above.
  - Remove `media_item_subject_tags` and migrate any residual references.
  - Create views or RPCs for quick lookup: `media_face_instances_with_tags`.
- **Server services**
  - Extend `lib/db/media.ts` fetchers to join `media_face_instances` and `media_tags`.
  - New CRUD actions:
    - `listPersonTags`, `createPersonTag` (admin-only), `searchPersonTags`.
    - `assignTagToFace(media_item_id, face_instance_id, tag_id)`.
    - `createFaceInstanceFromDetection` to persist bounding boxes when MediaPipe runs.
  - Update face-detection action (`saveFaceDetectionResults`) to:
    - Persist detected faces in `media_face_instances` with `type='auto'`.
    - Maintain link to bounding box JSON (pixel + normalized coordinates).
  - Ensure auto-detected entries set `training_candidate=false`.

### Frontend

- **Media viewer updates**
  - When face detection metadata exists, render per-face controls (probably under `MediaAlbumItems.tsx` modal or dedicated viewer component).
  - UI flow:
    1. Fetch `media_face_instances` for item.
    2. Display existing tag assignment; show chip (auto/manual).
    3. Provide combo box for selecting tag (search via debounce) or “Create new person tag” inline.
  - Disable tagging for items without face detection metadata; show CTA to run detection.
  - Ensure `subject_tags` overlay highlights selected face when editing.

- **Tag management modal**
  - Reuse shadcn `Command` or `Combobox` component for search (admin-only affordance to create new tags).
  - Handle multi-select for future expansions but limit to one person per face now.

### RBAC & Permissions

- Require `media` edit permission (granted through `media_album_editor` or higher) before modifying tags; ownership of the media item no longer affects authorization.
- Only users with the `media_tags.manage` permission (i.e., `media_admin`) can create or delete person tags.
- Users with edit permissions on a media album may assign an existing tag to any media item or face instance within that album.

### Analytics & Auditing

- Track user actions when assigning/removing tags (log table or Supabase storage for audit).

## Phase 2 – Training Dataset Selection *(For future review and implementation)*

### Requirements

- Users flag specific face instances (`training_candidate=true`) to build datasets per person.
- Need overview page showing counts per person and sampling progress (target 30–50 faces).

### Backend

- Extend API to toggle `training_candidate` flag.
- Provide aggregated query: `SELECT tag_id, COUNT(*) FILTER (WHERE training_candidate) AS candidate_count, COUNT(*) AS total_faces`.
- Implement server action `listTrainingCandidates(tag_id)` returning faces with thumbnails (cropped).
- Generate pre-signed URLs for cropped face previews (use new utility to crop on-demand via edge function or store precomputed crops).

### Frontend

- **New view** under `app/[locale]/media/training`:
  - Data table per person tag with counts, last updated, status.
  - Drill-down list showing candidate faces (thumbnail, source, confidence, bounding box overlay).
  - Bulk actions: mark/unmark candidate, remove auto-detected false positives.

### Storage & Processing

- Introduce background job (Edge Function or serverless) to generate and cache cropped face images at standard dimensions (e.g., 224x224 JPEG).
- Store crop metadata in `media_face_instances` (e.g., `crop_path` column) when generated.

## Phase 3 – External AI Model Integration *(For future review and implementation)*

### Training Pipeline

- **Dataset preparation**
  - Assemble zipped dataset per person with folder structure `person_name/{image_id}.jpg`.
- Use Azure Face ID Person Groups as the default provider (support additional providers later).
  - Persist manifest JSON in `media_model_training_jobs.payload`.

- **Job orchestration**
  - Create server action `startFaceTraining(tag_id, provider)`.
  - Steps:
    1. Validate candidate count >= threshold.
    2. Gather crop URLs; upload to Azure Blob Storage container dedicated to face-training datasets.
    3. Call Azure Face API to train/update the Person Group or Large Person Group.
    4. Poll job status; update `media_model_training_jobs`.

- **Inference Testing**
  - Add action `runFaceModelInference(model_id, media_item_id)`:
    - Generate crops or use full image depending on provider.
    - Save inference results as new `media_face_instances` with `type='auto'`, `ai_model_version`.
    - Allow user review/accept to convert into manual tags.
  - Provide UI entry point in training view (Phase 2 UI) to trigger and display inference results on selected media (single photo + bulk album run).

### Audit & Rollback

- Store raw API responses for traceability.
- Offer rollback to previous model version (archive job results, keep pointer to active version per person tag).

## Metadata & Auto-Detection Flags

- For every auto-generated face tag:
  - `type='auto'`.
  - `confidence` captured from provider.
  - Manual confirmation toggles `type='manual'` (or add `confirmed_at`, `confirmed_by` fields).
- When auto-detected person matches canonical tag via model inference, link to `person_tag_id` but maintain history.

## Open Questions

- Should we support shared/global person tags vs. per-organization lists?
- How do we handle duplicate names (merge flow vs. alias list)?
- Do we need soft-delete for tags (retain training history)?
- What mechanism should generate and store cropped face assets (on-demand edge vs. background queue)?

## Next Steps

1. Validate schema with stakeholders and confirm requirement for cross-organization sharing.
2. Draft Supabase SQL migrations for new tables + policies.
3. Implement Phase 1 backend services and face-detection persistence updates.
4. Build tagging UI prototype in media viewer.
5. Plan background job architecture for dataset preparation.


