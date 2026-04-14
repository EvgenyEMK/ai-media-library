# Path-Based Metadata Extraction

Extract dates, locations, readable titles (and in future: names, events) from file names and folder paths for media items in the desktop-media app.

---

## Motivation

Many media files -- especially older scanned photos, renamed files, and videos -- lack embedded EXIF/XMP metadata. However, their file names and folder paths often encode critical information: event dates, locations, people, and event descriptions. This feature extracts that information using fast regex scripts and optional LLM analysis.

---

## Challenges and Use Cases

### Challenge 1: Date / Period Extraction

**Problem:** EXIF "date taken" is often missing or wrong (e.g., scan date of an old physical photo instead of the real event date).

**Use cases:**

| Pattern | Example | Extracted |
|---------|---------|-----------|
| Date at start | `2009-02-07 Alex Sample birthday party` | day: 2009-02-07 |
| Compact timestamp | `20200306_185130.jpg` | day: 2020-03-06 |
| IMG_ prefix | `IMG_20200306_185130.jpg` | day: 2020-03-06 |
| Year only | `ACME IT team 1999 Riverside.jpg` | year: 1999 |
| Year-month | `1994-09 Tech University group...` | month: 1994-09 |
| Range YYYY-YYYY | `1992-1998 University student group` | range: 1992..1998 |
| Range YYYY--YY | `1982--91 Lincoln High` | range: 1982..1991 |
| Range with spaces | `1992 - 1998 ...` or `1982 -- 91 ...` | range |
| Day span | `1997-01-15 -- 18` | range: 1997-01-15..1997-01-18 |
| Cross-date range | `YYYY-MM-DD -- MM-DD` | range |
| Full cross-date | `YYYY-MM-DD -- YYYY-MM-DD` | range |
| Folder-only date | `D:\SamplePhotos\2002-08\scan0006.jpg` | month: 2002-08 (from folder) |
| Multi-level hierarchy | grandparent > parent > file | filename wins |
| Scanned photo | EXIF = scan date, folder = real date | path date wins when earlier |

**Event date resolution rules:**

1. If both EXIF and path date exist: if path year < EXIF year, use path date (scanned photo). Otherwise use EXIF.
2. If only EXIF -> use EXIF.
3. If only path date -> use path date.
4. If neither -> use file mtime as fallback.

### Challenge 2: Location Extraction

**Problem:** GPS data is often missing. Location info may be encoded in filenames or folder paths.

**Use cases:**

- Parenthesized location: `2009 Pat at home (Sampleton, North District, 12 Example Lane)`
- Trailing location word: `ACME IT team 1999 Riverside.jpg`
- Folder-level location: `1982--91 Lincoln High`
- Mixed-language names

**Structured fields:** country, area (province/state/canton), city, place name. Partial data is acceptable.

**Location resolution priority:**

1. GPS reverse-geocode (future)
2. Embedded XMP/IPTC location
3. Path extraction (script or LLM)
4. AI vision analysis

### Challenge 3: Name Extraction (FUTURE)

Extract person names from file/folder paths. Could suggest names for face tag assignment.

### Challenge 4: Event Extraction (FUTURE)

Extract event descriptions ("birthday party", "school trip") as a special tag type.

### Challenge 5: Readable Title from Filename

Clean up filenames into readable display titles by removing:

- File extensions
- Leading/trailing scan identifiers: `scan0021`, `IMG_1234`, `DSC_`, `DSCN_`
- Trailing isolated digits
- Leading digit-only sequences when followed by real text

**Examples:**

- `1975-08 учимся ходить с мамой (6месяцев) scan0021.jpg` -> `1975-08 учимся ходить с мамой (6месяцев)`
- `scan0021 Real title of image.jpg` -> `Real title of image`
- `1994-09 Tech University group September 1994 Botanical garden 1.jpg` -> cleaned title

---

## Example File Paths

```
File names:
  2009-02-07 Alex Sample birthday party
  2009 Pat at home (Sampleton, North District, 12 Example Lane)
  2009-02-14 Winter street fair
  ACME IT team 1999 Riverside.jpg
  1994-09 Tech University group September 1994 Botanical garden 1.jpg

Folder: "1992-1998 University group State Tech (Central Campus)"
  Files: "1994-09 Tech University group September 1994 Botanical garden 1", "scan"

Full paths:
  D:\SamplePhotos\2002-08\Subfolder\scan0006.jpg
  D:\SamplePhotos\SomeFolder\Subfolder\20200306_185130.jpg
  D:\MediaArchive\Photo 0000--1999\1982--91 Lincoln High\Class photo Anna Example, Kate Sample, Olga Demo,.jpg
```

---

## Data Model

### DB Columns on `media_items`

| Column | Type | Purpose |
|--------|------|---------|
| `event_date_start` | TEXT | Resolved event date (partial ISO: YYYY, YYYY-MM, YYYY-MM-DD) |
| `event_date_end` | TEXT | End of range (null if single date) |
| `event_date_precision` | TEXT | `'year' \| 'month' \| 'day' \| 'instant'` |
| `event_date_source` | TEXT | `'exif' \| 'xmp' \| 'path_script' \| 'path_llm' \| 'manual' \| 'file_mtime'` |
| `location_area` | TEXT | Province / state / canton (extends existing city, country) |
| `location_place` | TEXT | Specific place name |
| `location_source` | TEXT | `'gps' \| 'embedded_xmp' \| 'path_script' \| 'path_llm' \| 'ai_vision'` |
| `display_title` | TEXT | Cleaned readable title from filename |
| `path_extraction_at` | TEXT | When script extraction ran |
| `path_llm_extraction_at` | TEXT | When LLM extraction ran |

### ai_metadata JSON Extensions

- `path_extraction`: raw extraction data (date, location, names, events, display_title)
- `locations_by_source[]`: array of location objects from each source for provenance

---

## Pipeline Integration

### Fast Script Extraction (during metadata scan)

Runs inline during the existing metadata scan pipeline after EXIF extraction. Pure regex, no I/O overhead. Does NOT invalidate face detection, AI analysis, or embedding pipelines.

### LLM Path Analysis (separate optional pipeline)

Triggered from folder context menu. Batches 10-20 paths per LLM call (text-only, no vision). Uses configurable text model (default: qwen2.5:7b).

### Settings

- "Extract dates from file name and path" (default: on)
- "Extract location from file name and path" (default: on)
- "Use LLM to analyse file name and path to extract location and dates" (default: off)

---

## Search and Filter Integration

- **Date filter:** Year range picker [Start] - [End], either optional
- **Location filter:** Single text input "Country / City" matched via LIKE across all location columns
- **FTS:** display_title and location fields indexed in FTS5
- **Future:** LLM-based location query parsing for mixed/fuzzy input
