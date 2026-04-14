---
name: Path Metadata Extraction
overview: Design and implement a path-based metadata extraction system for desktop-media that extracts dates/periods, locations, and readable titles from file names and folder paths using both fast regex scripts and optional LLM analysis, with provenance tracking and search/filter integration.
todos:
  - id: requirements-doc
    content: Create docs/IMPLEMENTATION-LOG/features/2026-04_path_metadata_extraction.md with all requirements, examples, and design decisions
    status: completed
  - id: types
    content: Define PathExtractionMetadata types and extend MediaMetadataV2 with path_extraction section
    status: completed
  - id: migration
    content: Add DB migration for new columns (event_date_*, location_area, location_place, location_source, display_title, path_extraction_at, path_llm_extraction_at) and indexes
    status: completed
  - id: date-extractor
    content: Implement fast regex date extractor (date-extractor.ts) with comprehensive pattern support + tests
    status: completed
  - id: title-extractor
    content: Implement filename-to-title cleaner (title-extractor.ts) handling identifiers at start and end + tests
    status: completed
  - id: event-date-resolver
    content: Implement event date resolution logic merging EXIF + path + mtime sources + tests
    status: completed
  - id: pipeline-script
    content: Integrate fast script extraction into metadata scan pipeline without invalidating other pipelines
    status: completed
  - id: llm-analyzer
    content: Implement LLM path analyzer with batched multi-file prompt template (llm-path-analyzer.ts)
    status: completed
  - id: llm-pipeline
    content: Create LLM path analysis pipeline with IPC handlers, progress events, and folder menu integration
    status: completed
  - id: filter-integration
    content: Extend SemanticFilters, quick filters (year range + location text), and FTS with date/location filtering
    status: completed
  - id: settings
    content: Add path extraction settings (script date/location toggles + LLM toggle) to desktop settings UI and store
    status: completed
isProject: false
---

# Path-Based Metadata Extraction System

## 1. Requirements Summary

### Challenge 1: Date/Period Extraction from File Path

**Problem:** Many old photos/videos lack EXIF "date taken". Dates may be embedded in filenames or folder paths in varying formats and positions. Sometimes EXIF date is wrong (e.g., scan date of an old physical photo).

**Use cases:**

- Date at start of filename: `2009-02-07 Misha Kalinin birthday party`
- Compact date in filename: `20200306_185130.jpg` -> 2020-03-06
- Partial date (year only): `JTI IT team 1999 Zelenogorsk.jpg`
- Partial date (year-month): `1994-09 Группа ЛЭТИ...`
- Date range in folder: `1992-1998 Группа университета СПбГЭТУ (ЛЭТИ)`
- Date range with short year: `1982--91 School 481` -> 1982..1991
- Date range with spaces: `1992 - 1998 ...` or `1982 -- 91 ...`
- Date range with day span: `1997-01-15 -- 18` (also with spaces: `1997-01-15  --  18`)
- Cross-date range: `YYYY-MM-DD -- MM-DD` or `YYYY-MM-DD -- YYYY-MM-DD`
- Date only in folder path: `C:\Photos\2002-08\Subfolder\scan0006.jpg`
- Multi-level folder hierarchy with dates: grandparent > parent > file
- EXIF date is scan date, but folder/filename has the real event date (photo of old photo)

**Additional related use cases:**

- Files with timestamps: `IMG_20200306_185130.jpg`, `DSC_1234.jpg` (no date)
- Multiple dates in a path (folder date vs filename date) — filename takes precedence
- Date in folder but not in filename (e.g., `2002-08/scan0006.jpg`)
- Videos with date in filename but no EXIF

**Requirements:**

- Two-tier extraction: (a) fast regex script, (b) optional LLM for complex cases
- Integrate into metadata scan pipeline
- Track provenance via `event_date_source` column (where the resolved date came from)
- Differentiate exact date vs period (date range) via `event_date_start` / `event_date_end`
- Store raw path extraction details in `ai_metadata.path_extraction` (not separate DB columns)
- Searchable/filterable by date or period (for smart albums)

### Challenge 2: Location Extraction from Path

**Problem:** GPS data often missing. Location info may be in filename or folder path.

**Use cases:**

- Location in parentheses: `2009 Дениска дома (Geneve, Gd Lancy, Ch Louis Burgy 2a)`
- Location as trailing word: `JTI IT team 1999 Zelenogorsk.jpg`
- Location in folder name: `1982--91 School 481`
- Mixed language location names

**Requirements:**

- Extract structured location: country, area/state, city, place name (partial OK)
- Primarily LLM-based (free-form text too hard for regex)
- Unified location columns in DB: extend existing `city`, `country` with new `location_area`, `location_place`
- Single `location_source` column tracks provenance: `'gps'`, `'path_script'`, `'path_llm'`, `'ai_vision'`, `'embedded_xmp'`
- Resolution priority: GPS reverse-geocode (future) > embedded XMP/IPTC > path extraction > AI vision analysis
- Multi-source raw data stored in `ai_metadata` (one location object per source)
- Future: reverse geocoding from GPS -> same unified location fields

### Challenge 3: Name Extraction (FUTURE -- architecture only)

Extract person names from path. Possibly suggest for face tag assignment. Types reserved in `ai_metadata.path_extraction.names`.

### Challenge 4: Event Extraction (FUTURE -- architecture only)

Extract event descriptions (e.g., "birthday party", "school trip") as a special tag type. Types reserved in `ai_metadata.path_extraction.events`.

### Challenge 5: Readable Title from Filename

**Examples:**

- `1975-08 учимся ходить с мамой (6месяцев) scan0021.jpg` -> `1975-08 учимся ходить с мамой (6месяцев)`
- `scan0021 Real title of image.jpg` -> `Real title of image`
- `1994-09 Группа ЛЭТИ Сентябрь 1994 Ботанический сад 1.jpg` -> cleaned, without trailing number/extension junk

**Full examples from requirements:**

```
File names:
  2009-02-07 Misha Kalinin birthday party
  2009 Дениска дома (Geneve, Gd Lancy, Ch Louis Burgy 2a)
  2009-02-14 Fête de Genève
  JTI IT team 1999 Zelenogorsk.jpg
  1994-09 Группа ЛЭТИ Сентябрь 1994 Ботанический сад 1.jpg

Folder: "1992-1998 Группа университета СПбГЭТУ (ЛЭТИ)"
  Files: "1994-09 Группа ЛЭТИ Сентябрь 1994 Ботанический сад 1", "scan"

Full paths:
  C:\Photos\2002-08\Subfolder\scan0006.jpg
  C:\Photos\SomeFolder\Subfolder\20200306_185130.jpg
  C:\EMK-Media\Photo 0000--1999\1982--91 School 481\ЛТО Наташа Дикорева, Катя Бычкова, Ольга Роот,.jpg
```

---

## 2. Data Model Design

### 2.1 New SQLite Columns on `media_items`

Add via a new migration in [electron/db/client.ts](apps/desktop-media/electron/db/client.ts):

```sql
-- Resolved event date (best available from all sources, used for filtering)
ALTER TABLE media_items ADD COLUMN event_date_start TEXT;
ALTER TABLE media_items ADD COLUMN event_date_end TEXT;
ALTER TABLE media_items ADD COLUMN event_date_precision TEXT;
ALTER TABLE media_items ADD COLUMN event_date_source TEXT;

-- Extend existing location columns (city, country already exist)
ALTER TABLE media_items ADD COLUMN location_area TEXT;
ALTER TABLE media_items ADD COLUMN location_place TEXT;
ALTER TABLE media_items ADD COLUMN location_source TEXT;

-- Readable title from filename
ALTER TABLE media_items ADD COLUMN display_title TEXT;

-- Pipeline tracking
ALTER TABLE media_items ADD COLUMN path_extraction_at TEXT;
ALTER TABLE media_items ADD COLUMN path_llm_extraction_at TEXT;
```

Indexes for filtering:

```sql
CREATE INDEX IF NOT EXISTS idx_media_items_event_date
  ON media_items(library_id, event_date_start, event_date_end);
CREATE INDEX IF NOT EXISTS idx_media_items_location
  ON media_items(library_id, country, city, location_area);
```

**Column semantics:**

- `event_date_start` / `event_date_end`: The "effective" date for filtering. Partial ISO strings: `"1994"`, `"1994-09"`, `"1994-09-15"`. `event_date_end` is non-null only for ranges.
- `event_date_precision`: `'year' | 'month' | 'day' | 'instant'`
- `event_date_source`: `'exif' | 'xmp' | 'path_script' | 'path_llm' | 'manual' | 'file_mtime'`
- `location_area`: Province, state, canton, region (new, complements existing `city`, `country`)
- `location_place`: Specific place name like "Eiffel Tower", "Ботанический сад" (new)
- `location_source`: `'gps' | 'embedded_xmp' | 'path_script' | 'path_llm' | 'ai_vision'`
- `display_title`: Cleaned human-readable title derived from filename
- `path_extraction_at` / `path_llm_extraction_at`: Pipeline timestamps

*No separate `path_date_` or `path_location_`* columns.** Raw extraction data from each source is stored only in `ai_metadata.path_extraction` (JSON). The DB columns above are the *resolved* values used for filtering.

### 2.2 Extended `ai_metadata` JSON (MediaMetadataV2)

Add two new sections to [MediaMetadataV2](app/types/media-metadata.ts):

```typescript
// --- Path extraction raw results (stored in ai_metadata only) ---

export interface PathDateExtraction {
  start: string | null;           // "1994-09"
  end: string | null;             // null or "1998"
  precision: 'year' | 'month' | 'day';
  source: PathExtractionSource;
  raw_match?: string;             // original text that was matched
  from_folder_depth?: number;     // 0 = filename, 1 = parent, 2 = grandparent
}

export interface PathLocationExtraction {
  country?: string | null;
  country_code?: string | null;
  area?: string | null;
  city?: string | null;
  place_name?: string | null;
  source: PathExtractionSource;
  raw_match?: string;
}

export type PathExtractionSource =
  | 'script_filename'
  | 'script_folder'
  | 'script_filename+folder'
  | 'llm_path';

export interface PathExtractionMetadata {
  date?: PathDateExtraction | null;
  location?: PathLocationExtraction | null;
  names?: string[] | null;        // FUTURE
  events?: string[] | null;       // FUTURE
  display_title?: string | null;
  extracted_at?: string | null;
  llm_extracted_at?: string | null;
  llm_model?: string | null;
}

// --- Multi-source location (stored in ai_metadata) ---

export type LocationSource = 'gps' | 'embedded_xmp' | 'path_script'
  | 'path_llm' | 'ai_vision';

export interface SourcedLocation {
  country?: string | null;
  country_code?: string | null;
  area?: string | null;
  city?: string | null;
  place_name?: string | null;
  coordinates?: Coordinates | null;
  source: LocationSource;
}

// Add to MediaMetadataV2:
export interface MediaMetadataV2 {
  // ... existing fields ...
  path_extraction?: PathExtractionMetadata | null;
  locations_by_source?: SourcedLocation[] | null;
}
```

`**locations_by_source**` stores all location data from every source (GPS, XMP, path, AI vision). The resolution logic picks the best one and writes it to the unified DB columns (`country`, `city`, `location_area`, `location_place`, `location_source`).

### 2.3 Event Date Resolution Logic

Simple priority rules in `electron/path-extraction/event-date-resolver.ts`:

```
1. Manual override (future, highest priority)
2. If EXIF date AND path date both exist:
   - If path date year < EXIF year → use path date (scanned old photo scenario)
   - Otherwise → use EXIF (more precise, path date is probably the same event)
3. If only EXIF date → use EXIF
4. If only path date → use path date
5. If neither → use file_created_at / mtime as last resort (source = 'file_mtime')
```

`event_date_source` tracks which source won. No need to store both values in DB columns -- the raw path extraction data lives in `ai_metadata.path_extraction.date`.

### 2.4 Location Resolution Logic

Priority for unified location DB columns:

```
1. GPS reverse-geocode (future, highest priority)
2. Embedded XMP/IPTC location fields
3. Path extraction (script or LLM)
4. AI vision analysis (existing photo_analysis location)
```

Each source writes to `ai_metadata.locations_by_source[]`. The resolver picks the highest-priority non-empty source and writes to `country`, `city`, `location_area`, `location_place`, `location_source`.

---

## 3. Extraction Modules

### 3.1 Fast Script: Date Extraction from Path

New file: `electron/path-extraction/date-extractor.ts`

**Regex patterns to support (in priority order):**

- `YYYY-MM-DD` at any position: `2009-02-07 party` -> day: 2009-02-07
- `YYYYMMDD_HHMMSS`: `20200306_185130.jpg` -> day: 2020-03-06
- `YYYYMMDD` (8 digits, not part of longer number): `20200306.jpg` -> day: 2020-03-06
- `YYYY-MM` (not followed by another `-DD`): `1994-09 Группа` -> month: 1994-09
- `YYYY` standalone (word boundary): `team 1999 Zelenogorsk` -> year: 1999
- Range `YYYY-YYYY` or `YYYY - YYYY`: `1992-1998` -> range: 1992..1998
- Range `YYYY--YY` or `YYYY -- YY`: `1982--91` -> range: 1982..1991
- Range `YYYY-MM-DD -- DD` or `YYYY-MM-DD  --  DD`: `1997-01-15 -- 18` -> range: 1997-01-15..1997-01-18
- Range `YYYY-MM-DD -- MM-DD`: `2009-02-07 -- 02-14` -> range: 2009-02-07..2009-02-14
- Range `YYYY-MM-DD -- YYYY-MM-DD`: `2009-02-07 -- 2009-03-01` -> range: 2009-02-07..2009-03-01
- `IMG_YYYYMMDD_`* prefix: `IMG_20200306_185130.jpg` -> day: 2020-03-06
- Path segment date: `C:\Photos\2002-08\...` -> month: 2002-08 (from folder)

**Algorithm:**

1. Extract dates from filename (without extension) -- try all patterns
2. Extract dates from each folder segment in the path (walk up from parent)
3. Merge: filename date takes precedence; folder date fills gaps
4. Return `PathDateExtraction` with source provenance (`script_filename`, `script_folder`, or `script_filename+folder`)

### 3.2 Fast Script: Title Cleanup

New file: `electron/path-extraction/title-extractor.ts`

**Algorithm:**

1. Remove file extension
2. Remove leading scan/file identifiers: `scan0021`, `IMG_1234`, `DSC_1234`, `DSCN_`, `P1010234`, leading digit-only sequences when followed by real text
3. Remove leading date pattern (if present, but keep date if it's part of the meaningful title context)
4. Remove trailing scan/file identifiers: `scan0021`, `IMG_1234`, trailing isolated digits
5. Remove trailing whitespace, commas, dots, dashes
6. Trim and return; return `null` if result is empty or only digits

### 3.3 LLM Path Analysis

New file: `electron/path-extraction/llm-path-analyzer.ts`

**Batched prompt template** (text-only, no vision, sent with multiple file paths):

```
You are a metadata extraction engine for a personal photo/video library.
Given a list of full file paths, extract structured metadata from each
filename and its folder hierarchy. Folders often encode event dates,
locations, and people names.

File paths:
1. C:\EMK-Media\Photo 0000--1999\1982--91 School 481\ЛТО Наташа Дикорева.jpg
2. C:\Photos\2009\2009-02-07 Misha Kalinin birthday party\IMG_0042.jpg
3. ...

Return a JSON array with one object per file, in the same order:
[
  {
    "index": 1,
    "date": {
      "start": "YYYY or YYYY-MM or YYYY-MM-DD or null",
      "end": "null or same format (for ranges)",
      "precision": "year | month | day"
    },
    "location": {
      "country": "country name or null",
      "country_code": "ISO 2-letter code or null",
      "area": "province/state/canton or null",
      "city": "city name or null",
      "place_name": "specific place or null"
    },
    "names": ["person names found, or empty array"],
    "events": ["event descriptions, or empty array"],
    "display_title": "cleaned readable title"
  },
  ...
]

Rules:
- Use folder hierarchy context to infer dates/locations not explicit in filename
- If a folder name contains a date range, apply it to files within
- Return null for fields you cannot determine
- Keep display_title concise: strip file extensions, scan IDs, camera prefixes
- Return ONLY the JSON array
```

**Batching:** 10-20 paths per LLM call. Use Ollama `/api/chat` with `format: "json"`, `stream: false`. Model: `qwen2.5:7b` or configurable text model (no vision needed).

---

## 4. Pipeline Integration

### 4.1 Phase 1: Integrate into Metadata Scan (fast script only)

Modify [runMetadataScanJob](apps/desktop-media/electron/ipc/metadata-scan-handlers.ts):

After `upsertMediaItemFromFilePath` succeeds for each file, call the fast script extractor and persist results. This adds negligible overhead (pure regex, no I/O).

```
[existing] prepare -> observe files -> scan (EXIF) -> reconcile
[new]                                  +-> path date extraction (script)
                                       +-> title cleanup (script)
                                       +-> event date resolution
                                       +-> update event_date_* and display_title columns
```

**Critical: no pipeline invalidation.** Writing `event_date_`*, `display_title`, `location_`*, `path_extraction_at` columns must NOT trigger `invalidateMediaItemAiAfterMetadataRefresh`. These columns are independent of face detection, AI image analysis, and embedding pipelines. The invalidation guard in [media-ai-invalidation-guards.ts](apps/desktop-media/electron/db/media-ai-invalidation-guards.ts) already checks specific columns (width/height/orientation/content_hash); the new columns are not in that list, so no changes needed there -- but verify during implementation.

### 4.2 Phase 2: LLM Path Analysis (separate optional pipeline)

New pipeline triggered from folder context menu (similar to photo-analysis):

- New IPC channels: `IPC_CHANNELS.analyzeFolderPathMetadata`, `IPC_CHANNELS.cancelPathAnalysis`
- New handler: `electron/ipc/path-analysis-handlers.ts`
- Batches paths (10-20 per LLM call), parses response, stores to `ai_metadata.path_extraction`
- Updates location DB columns if LLM provides location data (respecting priority)
- Refines `display_title` if LLM gives better result
- Re-runs event date resolution if LLM provides date data
- Progress events: `pathAnalysisProgress`
- **Does NOT invalidate** face detection, photo analysis, or embedding pipelines

### 4.3 Settings Integration

Add to desktop settings ([DesktopSettings](apps/desktop-media/src/shared/ipc.ts)):

- **"Extract dates from file name and path"** (`pathExtraction.extractDates: boolean`, default: `true`)
- **"Extract location from file name and path"** (`pathExtraction.extractLocation: boolean`, default: `true`)
- **"Use LLM to analyse file name and path to extract location and dates"** (`pathExtraction.useLlm: boolean`, default: `false`)
- `pathExtraction.llmModel: string` (default: `qwen2.5:7b`, shown only when LLM is enabled)

---

## 5. Search and Filter Integration

### 5.1 Extend SemanticFilters (DB layer)

In [electron/db/semantic-search.ts](apps/desktop-media/electron/db/semantic-search.ts) add:

```typescript
export interface SemanticFilters {
  // ... existing ...
  eventDateStart?: string;    // "1994" or "1994-09" or "1994-09-15"
  eventDateEnd?: string;
  locationQuery?: string;     // free-text, searched against all location columns
}
```

SQL WHERE clause additions for date:

```sql
-- Date range overlap: items whose [event_date_start, event_date_end] overlaps [filterStart, filterEnd]
AND event_date_start IS NOT NULL
AND event_date_start <= :filterEnd
AND COALESCE(event_date_end, event_date_start) >= :filterStart
```

SQL WHERE clause for location (v1 -- simple LIKE across all columns):

```sql
AND (
  country LIKE :locationQuery
  OR city LIKE :locationQuery
  OR location_area LIKE :locationQuery
  OR location_place LIKE :locationQuery
  OR location_name LIKE :locationQuery
)
```

### 5.2 Extend Quick Filters (UI)

Add to [ThumbnailQuickFilterState](lib/media-filters/thumbnail-quick-filters.ts):

- **Date range:** Two year inputs `[Start Year]` - `[End Year]`, either is optional. If only start -> "from year X onward"; if only end -> "up to year X".
- **Location:** Single text input labeled "Country / City". User types a location string; matched via LIKE against all location columns (country, city, location_area, location_place).

### 5.3 Location Search -- Future Approaches

**Current (v1):** Simple LIKE/equality match across location columns. User enters one term (country OR city). Good enough for structured data.

**Future options for mixed/fuzzy input (e.g., "Gd Lancy, Geneva"):**

- **Option A: LLM query parsing.** Before executing the search, send the user's location input to Qwen2.5 (text model) to parse into structured fields: `{ country: "Switzerland", city: "Geneva", place: "Grand-Lancy" }`. Then use exact column matches. Pros: accurate for ambiguous input. Cons: adds latency per search.
- **Option B: FTS5 location search.** Index all location columns into FTS5 and use full-text matching. Pros: fast, handles partial matches. Cons: no semantic understanding.
- **Option C: Embedding-based semantic search.** Embed location strings and do vector similarity. Pros: handles synonyms and partial matches. Cons: complex, overkill for structured location data.

**Recommendation:** Start with v1 (LIKE). Add Option A (LLM parsing) as a follow-up -- same pattern as advanced search query understanding in [query-understanding.ts](apps/desktop-media/electron/query-understanding.ts).

### 5.4 FTS Integration

Update [syncFtsForMediaItem](apps/desktop-media/electron/db/keyword-search.ts) to include `display_title` and location fields (`location_area`, `location_place`) in the FTS5 `location` column alongside existing `city`, `country`, `location_name`.

---

## 6. File Structure (new files)

```
apps/desktop-media/electron/path-extraction/
  date-extractor.ts            # Fast regex date extraction (~150 lines)
  date-extractor.test.ts       # Tests with all pattern examples
  title-extractor.ts           # Filename -> readable title (~100 lines)
  title-extractor.test.ts      # Tests with all title examples
  event-date-resolver.ts       # Merge EXIF + path + mtime -> event_date (~80 lines)
  event-date-resolver.test.ts  # Tests for resolution priority
  location-resolver.ts         # Pick best location from multi-source data (~60 lines)
  llm-path-analyzer.ts         # LLM prompt, batching, response parsing (~150 lines)
  types.ts                     # PathDateExtraction, PathLocationExtraction, etc.
```

---

## 7. Requirements Document

Save a detailed requirements and design document at `docs/IMPLEMENTATION-LOG/features/2026-04_path_metadata_extraction.md` containing all examples, data model, pipeline integration, and future expansion notes.

---

## 8. Key Architecture Decisions

*Q: Why only `event_date_` in DB columns, not also `path_date_`*?**
A: The `event_date_`* columns are the resolved "best" date used for all filtering. Raw path extraction data is intermediate -- stored in `ai_metadata.path_extraction` for provenance/debugging, not needed as indexed columns. This keeps the schema lean.

*Q: Why unify location into existing `city`/`country` + new `location_area`/`location_place` instead of separate `path_location_` columns?**
A: There should be one set of "resolved" location columns regardless of source. Multi-source raw data lives in `ai_metadata.locations_by_source[]`. The resolution logic picks the best source and writes to the unified columns. `location_source` tracks provenance.

**Q: Why text-only LLM (not vision) for path analysis?**
A: Path analysis does not need image data. A text model like `qwen2.5:7b` is faster, cheaper, and sufficient. This is a separate pipeline from photo analysis.

**Q: Why batch LLM calls?**
A: Sending 10-20 paths per call dramatically reduces overhead vs one call per file. The prompt is adjusted for array input/output.

**Q: Why not extract location via regex script?**
A: Location names are free-form, multilingual, and context-dependent. Regex catches very few cases. LLM is far better suited for this task.

---

## 9. Separate Concern: ai_metadata Null Key Cleanup

Currently `ai_metadata` JSON stores many null-valued keys (full schema skeleton). This wastes storage and hurts readability. A future cleanup task (unrelated to this feature) should:

- Modify `normalizeMetadata` in [accessors.ts](lib/media-metadata/accessors.ts) to strip null/undefined leaf values
- Treat "key absent" as equivalent to `null` on read
- Run a one-time migration to compact existing rows

This is noted here for tracking but is out of scope for this feature.