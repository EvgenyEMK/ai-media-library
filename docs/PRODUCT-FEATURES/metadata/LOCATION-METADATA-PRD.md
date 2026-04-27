# Location Metadata PRD

## Purpose

The media library stores location metadata so users can find, filter, and browse media by places. Location data may come from high-confidence GPS coordinates, AI image analysis, or AI/file-path analysis. The product must preserve source provenance so the UI can distinguish “known from GPS” from “inferred by AI”.

## Product Goals

- Show useful place context in the PhotoViewer Info tab.
- Support quick filters and search filters by country, city, area, place, or free-text location.
- Support smart albums such as `Countries > Year > Visited Cities > Media items`.
- Allow users and smart album logic to filter locations by confidence/source:
  - GPS-only: trusted locations from embedded coordinates.
  - AI-derived: inferred locations from image content or file paths.
  - Mixed/all: all available location records.

## Location Sources

### GPS Reverse Geocoding

GPS is the highest-confidence source.

- Input: embedded latitude/longitude from EXIF/XMP or video metadata.
- Processing: reverse geocode coordinates to country, city, and administrative area.
- Stored catalog fields:
  - `media_items.latitude`
  - `media_items.longitude`
  - `media_items.country`
  - `media_items.city`
  - `media_items.location_area`
  - `media_items.location_source = 'gps'`
- GPS-sourced catalog location must not be overwritten by AI-derived location.

### VLM Image Analysis

VLM image analysis can infer visually recognizable locations, landmarks, countries, cities, or places.

- Current phase-1 contract: model returns one string in the prompt field `location`, formatted as `Country, City`.
- Phase-1 persistence requirement:
  - Parse `Country, City` into separate fields.
  - Store `media_items.country = Country`.
  - Store `media_items.city = City`.
  - Store `media_items.location_source = 'ai_vision'` when the row does not already have a higher-priority source.
  - Store raw/structured AI details in `ai_metadata.image_analysis.location`.
- VLM location must be treated as inferred, not GPS-trusted.
- VLM location must not overwrite rows where `location_source = 'gps'`.

Phase 2 should replace the string contract with a structured object:

```json
{
  "location": {
    "country": "United States",
    "country_code": "US",
    "area": "New York",
    "city": "New York City",
    "place_name": "Times Square",
    "confidence": 0.8
  }
}
```

### File Path LLM Extraction

Path LLM extraction infers location from folder names and filenames.

- Input examples:
  - `2024 Italy/Rome/IMG_1234.jpg`
  - `Paris holiday 2019/photo.jpg`
- Stored metadata:
  - `ai_metadata.path_extraction.location`
  - `ai_metadata.locations_by_source[]`
- Stored catalog fields when no higher-priority source is present:
  - `media_items.country`
  - `media_items.city`
  - `media_items.location_area`
  - `media_items.location_place`
  - `media_items.location_source = 'path_llm'`

Path-derived locations are useful for organization, but are not as trustworthy as GPS.

## Source Priority

When multiple sources provide location data, catalog fields should represent the best available source:

1. `gps`
2. `embedded_xmp`
3. `path_llm`
4. `path_script`
5. `ai_vision`

The catalog fields are the fast, filterable projection. Source-specific metadata should remain available in `ai_metadata` so future UI can show alternatives or confidence.

## Storage Model

### Catalog Fields

These fields power UI display and filters:

- `media_items.country`: country name only.
- `media_items.city`: city/locality only.
- `media_items.location_area`: state/province/region.
- `media_items.location_place`: specific place or landmark.
- `media_items.location_name`: legacy/general display location.
- `media_items.location_source`: source used for the catalog projection.

`country` must never contain a combined value like `United States, New York City`.

### Metadata JSON

Source-specific metadata should be retained:

- `ai_metadata.image_analysis.location`: VLM-derived location details.
- `ai_metadata.path_extraction.location`: file/folder-derived location details.
- `ai_metadata.locations_by_source[]`: normalized source list for future conflict resolution and audit UI.
- `ai_metadata.file_data.exif_xmp.location_text`: embedded text location if present.

## UI Usage

### PhotoViewer Info Tab

PhotoViewer displays the catalog location projection:

`country | location_area | city`

Example:

`United States | New York | New York City`

If `location_place` is available, future UI may show it as a separate “Place” row or append it after city, but it should not be stored in `country`.

### Metadata Tab

The Metadata tab shows raw `ai_metadata`, including source-specific data and raw AI output. This is for inspection/debugging, not the canonical user-facing place line.

## Filters and Search

### Thumbnail Quick Filters

Quick filters match a location text query against catalog fields:

- `country`
- `city`
- `location_area`
- `location_place`
- `location_name`

### AI Search and Keyword Search Filters

Search filters use the same catalog fields via SQL predicates. These filters should be source-aware in future UI by adding a location source selector:

- GPS only
- AI/path only
- All sources

### Album Filters

Album list filters match `locationQuery` against member media catalog fields. Date and location filters are combined at the album level by existence of matching member items.

## Smart Albums

Smart albums should use catalog fields and `location_source`.

Initial product groups:

- `Countries > Year > Visited Cities > Media items`
  - GPS-only source should be available.
  - AI/non-GPS source should be available separately.
- `Countries > Area > Cities > Media items`
  - Best for GPS because reverse geocoding provides administrative area.
- `Year > Trips`
  - Group by date range and location clusters.
  - First version may use month + countries count as an approximation.

Smart album source modes:

- `gps`: only `location_source = 'gps'`.
- `ai`: `location_source IN ('ai_vision', 'path_llm', 'path_script')`.
- `all`: all items with non-empty country/city.

## Acceptance Criteria

- GPS rows can be filtered independently from AI-derived rows.
- AI-derived rows never masquerade as GPS.
- `media_items.country` contains only country names.
- VLM location with current `Country, City` contract is parsed into separate `country` and `city` catalog fields.
- PhotoViewer Info tab uses catalog fields, not raw VLM strings.
- Smart albums can build country/city groupings from catalog fields and source filters.
