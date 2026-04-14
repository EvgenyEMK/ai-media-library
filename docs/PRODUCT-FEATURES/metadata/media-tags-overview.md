# Media Tagging Overview

## Canonical Tag Catalog (`media_tags`)
- Stores every tag used across the media library, including people, pets, themes, locations, and other categories.
- Each tag has a unique canonical name (`label`) plus a normalized form for consistent lookups.

## Person Profiles (`media_person_profiles`)
- One-to-one extension of `media_tags` that activates only for tags representing people.
- Holds person-specific metadata such as primary email, notes, and an `aliases` array for alternate names or nicknames that should be treated as the same individual.

## Media Item Tagging (`media_item_tags`)
- Connects canonical tags to entire media items.
- Captures the relationship “this photo/video depicts this person/theme/etc.” while recording whether the tag came from a manual user action or an automated process.

## Face Instance Tagging (`media_face_instances`)
- Records each detected face within a media item and links it back to the canonical person tag.
- Stores face-specific metadata such as bounding box coordinates, detection confidence, and the tagging source type (manual, automatic, imported, false_positive).

