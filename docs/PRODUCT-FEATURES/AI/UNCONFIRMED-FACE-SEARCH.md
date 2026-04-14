# Unconfirmed Face Search

This document describes the "Include unconfirmed similar faces" feature in the AI semantic search panel.

## Purpose

When **Include unconfirmed similar faces** is **off**, person-tag filtering in AI search requires an explicit face-to-person-tag assignment (`media_face_instances.tag_id`) for each selected tag. Photos where the person appears only as a similar but unconfirmed face are excluded.

The same panel toggle, **on by default** for new app sessions, expands filtering so each selected person can match either a **confirmed** tagged face **or** a precomputed **suggestion** row (`media_item_person_suggestions`) for that person on the media item.

## User-Perspective Process Flow

### Prerequisites

Before this feature is useful, the following must be in place:

1. **Face detection** has been run on at least some folders (Folders List).
2. **Face embeddings** have been generated for detected faces.
3. At least one **person tag** exists with confirmed faces (so a centroid can be computed).

### Main Flow

```
User runs face detection on folder tree(s)
         |
         v
User generates face embeddings (auto-chained or manual)
         |
         v
User tags faces with person tags
  (People -> Tagged faces, Unnamed faces, or PhotoViewer -> Faces tab)
         |
         v
System recomputes person centroid and refreshes suggestion index
         |
         v
User opens AI Semantic Search panel
         |
         v
User selects person tag chip(s) as filter
         |
         v
Toggle "Include unconfirmed similar faces" appears (on by default for new sessions)
         |
         v
User runs search (optionally turns toggle off to restrict to confirmed tags only)
         |
         v
When the toggle is on: results include both confirmed AND unconfirmed matches
```

### Alternative Flows

- **Tag-first (no clustering)**: user tags a few faces in PhotoViewer early, centroid exists, "Auto-detected matching faces" suggests more, user confirms in bulk. Suggestions index is populated as centroids update.
- **Cluster-first**: user clusters unnamed faces first, then assigns clusters to person tags in bulk. Suggestion index refreshes after each cluster assignment.
- **Manual refresh**: user can trigger a full suggestion refresh via `refreshPersonSuggestions` IPC call if suggestions seem stale.

## How It Works

### Suggestion Index

A precomputed table `media_item_person_suggestions` stores which media items likely contain a given person:

| Column | Description |
|--------|-------------|
| `library_id` | Library scope |
| `media_item_id` | The photo that likely contains the person |
| `tag_id` | The person tag |
| `best_similarity` | Highest cosine similarity among untagged faces in that photo vs the person centroid |
| `exemplar_face_instance_id` | The face instance that produced the best similarity |
| `updated_at` | When this suggestion was last refreshed |

### When Suggestions Are Updated

The suggestion index is refreshed incrementally:

- **After face tag assignment**: centroid changes, suggestions for that person are refreshed.
- **After face tag removal**: previous person's centroid changes, suggestions refreshed.
- **After cluster-to-person assignment**: centroid changes, suggestions refreshed.
- **Manual refresh**: full rebuild across all person tags.

### Search Filter Behavior

When the toggle is **off**:
- Only photos with explicitly tagged faces pass the person filter.

**Default (toggle on):** the desktop store initializes `semanticIncludeUnconfirmedFaces` to **true**, so new sessions search with unconfirmed expansion unless the user disables it.

When the toggle is **on**:
- For each selected person tag, a photo passes if it has:
  - A confirmed face instance with that tag, **OR**
  - An unconfirmed suggestion row in `media_item_person_suggestions`.
- AND semantics are preserved across multiple selected tags.

## UI Location

The toggle appears in the **Semantic Search panel**, below the person tag chips. It is only visible when at least one person tag chip is selected.

## Similarity Threshold

The default suggestion threshold is **0.38** (cosine similarity). This is recall-oriented: same-person pairs often fall in roughly the 0.35–0.55 range across age, pose, and lighting, so a lower cutoff surfaces more plausible matches than a strict “verification” threshold (for example **0.6** in the "Auto-detected matching faces" workflow).

The threshold can be adjusted in code via `refreshSuggestionsForTag` options.

## Data Model

### Existing Tables (unchanged)

- `media_face_instances`: face detections with optional `tag_id` (confirmed) and `embedding_json`.
- `person_centroids`: L2-normalized mean embedding per person tag.
- `face_clusters`: agglomerative clusters of unnamed faces.

### New Table

- `media_item_person_suggestions`: precomputed unconfirmed person presence per media item.

### Relationship

```
person_centroids (centroid per person)
        |
        | cosine similarity
        v
media_face_instances (untagged faces with embeddings)
        |
        | best match per media_item
        v
media_item_person_suggestions (precomputed index)
        |
        | EXISTS check at search time
        v
semantic search results (expanded to include unconfirmed)
```

## Constraints and Design Decisions

- Suggestions are a **search/filter signal only**. They never set `tag_id` on face instances.
- Suggestions are **deleted and rebuilt** per person tag on each refresh (not incrementally merged), ensuring stale data is cleared.
- The suggestion scan is capped at 50,000 untagged faces per refresh to keep wall-clock time bounded on large libraries.
- When a face is confirmed (tagged), the corresponding suggestion row is removed for that media item + tag combination.

## Future Enhancements

- Visual indicator in search results showing which matches are "unconfirmed" vs "confirmed".
- Per-person threshold configuration.
- Background periodic refresh job.
- Suggestion count display on person tag chips.
