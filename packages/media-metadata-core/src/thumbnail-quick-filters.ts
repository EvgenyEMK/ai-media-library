import type { MediaImageCategory } from "./media-metadata";
import {
  getAiCategory,
  normalizeMetadata,
  getFaceDetectionMethod,
  getNumberOfPeople,
  getPeopleBoundingBoxes,
  getAdditionalTopLevelFields,
} from "./accessors";

export type ThumbnailPeopleQuickFilter =
  | "none"
  | "gte_1"
  | "eq_1"
  | "gte_2"
  | "eq_2"
  | "gte_3"
  | "eq_3"
  | "gte_4"
  | "eq_4"
  | "gte_5"
  | "eq_5";

/** Shared by user Rating and AI Rating quick filters. */
export type ThumbnailRatingBandQuickFilter =
  | "unrated"
  | "eq_5"
  | "gte_4"
  | "eq_4"
  | "gte_3"
  | "eq_3"
  | "gte_2"
  | "eq_2"
  | "gte_1"
  | "eq_1";

/**
 * Categories quick filter: non-document visual classes only.
 * Document-like `image_category` values belong under **Documents** (and invoices / IDs there).
 */
export type ThumbnailCategoryQuickFilter =
  | "architecture"
  | "food"
  | "humor"
  | "nature"
  | "other"
  | "pet"
  | "sports";

export type ThumbnailDocumentsQuickFilter =
  | "all"
  | "invoice_or_receipt"
  | "document_id_or_passport"
  | "document_other";

export type ThumbnailMultiChoiceMode = "or" | "and";

export interface ThumbnailQuickFilterState {
  peopleEnabled: boolean;
  people: ThumbnailPeopleQuickFilter;
  userRatingEnabled: boolean;
  userRating: ThumbnailRatingBandQuickFilter;
  aiRatingEnabled: boolean;
  aiRating: ThumbnailRatingBandQuickFilter;
  documentsEnabled: boolean;
  documents: ThumbnailDocumentsQuickFilter;
  categoriesEnabled: boolean;
  category: ThumbnailCategoryQuickFilter;
  multiChoiceMode: ThumbnailMultiChoiceMode;
  dateRangeEnabled: boolean;
  dateRangeStartYear: number | null;
  dateRangeEndYear: number | null;
  locationEnabled: boolean;
  locationQuery: string;
}

export interface ThumbnailQuickFilterInput {
  metadata: unknown;
  detectedFaceCount?: number | null;
  /** Optional: denormalized `people_detected` from semantic search hits when AI blob is not cached yet */
  semanticPeopleDetected?: number | null;
  /**
   * User/catalog star rating only (not AI esthetic): e.g. desktop `star_rating` / XMP,
   * 1–5 only; -1/0/unset treated as unrated for the Rating filter.
   */
  fileStarRating?: number | null;
  /** Catalog `event_date_*` (path/EXIF resolved), ISO date strings. */
  catalogEventDateStart?: string | null;
  catalogEventDateEnd?: string | null;
  catalogCountry?: string | null;
  catalogCity?: string | null;
  catalogLocationArea?: string | null;
  catalogLocationPlace?: string | null;
  catalogLocationName?: string | null;
}

export const DEFAULT_THUMBNAIL_QUICK_FILTERS: ThumbnailQuickFilterState = {
  peopleEnabled: false,
  people: "gte_1",
  userRatingEnabled: false,
  userRating: "gte_4",
  aiRatingEnabled: false,
  aiRating: "gte_4",
  documentsEnabled: false,
  documents: "all",
  categoriesEnabled: false,
  category: "nature",
  multiChoiceMode: "or",
  dateRangeEnabled: false,
  dateRangeStartYear: null,
  dateRangeEndYear: null,
  locationEnabled: false,
  locationQuery: "",
};

interface CategoryOption {
  key: ThumbnailCategoryQuickFilter;
  label: string;
  categories: MediaImageCategory[];
}

/** Maps each quick-filter category key to AI `image_category` (one canonical value each). */
export const THUMBNAIL_CATEGORY_OPTIONS: CategoryOption[] = [
  { key: "architecture", label: "Architecture", categories: ["architecture"] },
  { key: "food", label: "Food", categories: ["food"] },
  { key: "humor", label: "Humor", categories: ["humor"] },
  { key: "nature", label: "Nature", categories: ["nature"] },
  { key: "other", label: "Other", categories: ["other"] },
  { key: "pet", label: "Pet", categories: ["pet"] },
  { key: "sports", label: "Sports", categories: ["sports"] },
];

interface DocumentOption {
  key: Exclude<ThumbnailDocumentsQuickFilter, "all">;
  label: string;
  categories: MediaImageCategory[];
}

export const THUMBNAIL_DOCUMENT_OPTIONS: DocumentOption[] = [
  {
    key: "invoice_or_receipt",
    label: "Invoices / receipts",
    categories: ["invoice_or_receipt"],
  },
  {
    key: "document_id_or_passport",
    label: "IDs",
    categories: ["document_id_or_passport"],
  },
  {
    key: "document_other",
    label: "Other documents",
    categories: ["document_contract", "document_other", "presentation_slide", "diagram", "screenshot"],
  },
];

/** Union of every `MediaImageCategory` treated as a document for quick filters (Documents → All). */
export const THUMBNAIL_ALL_DOCUMENT_CATEGORIES: ReadonlySet<MediaImageCategory> = new Set(
  THUMBNAIL_DOCUMENT_OPTIONS.flatMap((o) => o.categories),
);

export const THUMBNAIL_PEOPLE_OPTIONS: Array<{
  value: ThumbnailPeopleQuickFilter;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "gte_1", label: "≥ 1" },
  { value: "eq_1", label: "= 1" },
  { value: "gte_2", label: "≥ 2" },
  { value: "eq_2", label: "= 2" },
  { value: "gte_3", label: "≥ 3" },
  { value: "eq_3", label: "= 3" },
  { value: "gte_4", label: "≥ 4" },
  { value: "eq_4", label: "= 4" },
  { value: "gte_5", label: "≥ 5" },
  { value: "eq_5", label: "= 5" },
];

export const THUMBNAIL_RATING_BAND_OPTIONS: Array<{
  value: ThumbnailRatingBandQuickFilter;
  label: string;
}> = [
  { value: "unrated", label: "None" },
  { value: "eq_5", label: "= 5" },
  { value: "gte_4", label: "≥ 4" },
  { value: "eq_4", label: "= 4" },
  { value: "gte_3", label: "≥ 3" },
  { value: "eq_3", label: "= 3" },
  { value: "gte_2", label: "≥ 2" },
  { value: "eq_2", label: "= 2" },
  { value: "gte_1", label: "≥ 1" },
  { value: "eq_1", label: "= 1" },
];

export function getThumbnailCategoryOption(
  key: ThumbnailCategoryQuickFilter,
): CategoryOption | undefined {
  return THUMBNAIL_CATEGORY_OPTIONS.find((option) => option.key === key);
}

export function getThumbnailDocumentOption(
  key: Exclude<ThumbnailDocumentsQuickFilter, "all">,
): DocumentOption | undefined {
  return THUMBNAIL_DOCUMENT_OPTIONS.find((option) => option.key === key);
}

export function hasActiveQuickFilters(filters: ThumbnailQuickFilterState): boolean {
  return countActiveQuickFilters(filters) > 0;
}

export function countActiveQuickFilters(filters: ThumbnailQuickFilterState): number {
  let count = 0;
  if (filters.peopleEnabled) count += 1;
  if (filters.userRatingEnabled) count += 1;
  if (filters.aiRatingEnabled) count += 1;
  if (filters.documentsEnabled) count += 1;
  if (filters.categoriesEnabled) count += 1;
  if (filters.dateRangeEnabled) count += 1;
  if (filters.locationEnabled) count += 1;
  return count;
}

/**
 * User star rating for quick filters: **only** the catalog/file value (argument),
 * never AI analysis or loose keys inside `metadata` (avoids mixing with esthetic scores).
 */
export function deriveUserRatingStars(fileStarRating?: number | null): number | null {
  if (typeof fileStarRating === "number" && Number.isFinite(fileStarRating)) {
    if (fileStarRating >= 1 && fileStarRating <= 5) {
      return Math.round(fileStarRating);
    }
  }
  return null;
}

/** AI photo_estetic_quality only, mapped to 1–5 (same formula as legacy aesthetic filter). */
export function deriveAiQualityStars(metadata: unknown): number | null {
  const normalizedQuality = normalizeQuality(metadata);
  if (normalizedQuality === null) {
    return null;
  }
  return Math.ceil(normalizedQuality / 2);
}

export function matchesThumbnailQuickFilters(
  input: ThumbnailQuickFilterInput,
  filters: ThumbnailQuickFilterState,
): boolean {
  if (!hasActiveQuickFilters(filters)) {
    return true;
  }

  const category = getAiCategory(input.metadata);
  if (filters.peopleEnabled && category === "document_id_or_passport") {
    return false;
  }

  const peopleCount = derivePeopleCount(input);
  if (!matchesPeopleFilter(peopleCount, filters)) {
    return false;
  }

  const userStars = deriveUserRatingStars(input.fileStarRating);
  if (!matchesRatingBandFilter(userStars, filters.userRating, filters.userRatingEnabled)) {
    return false;
  }

  const aiStars = deriveAiQualityStars(input.metadata);
  if (!matchesRatingBandFilter(aiStars, filters.aiRating, filters.aiRatingEnabled)) {
    return false;
  }

  if (!matchesDocumentsFilter(category, filters.documentsEnabled, filters.documents)) {
    return false;
  }

  if (!matchesCategoryDimensionFilter(category, filters)) {
    return false;
  }

  if (!matchesEventYearQuickFilter(input, filters)) {
    return false;
  }

  if (!matchesLocationQuickFilter(input, filters)) {
    return false;
  }

  return true;
}

/** Maps quick-filter year range + location text into semantic/keyword search filter fields. */
export function quickFiltersToSearchEventLocationExtras(
  filters: ThumbnailQuickFilterState,
): { eventDateStart?: string; eventDateEnd?: string; locationQuery?: string } {
  const out: { eventDateStart?: string; eventDateEnd?: string; locationQuery?: string } = {};
  if (filters.dateRangeEnabled) {
    const y1 = filters.dateRangeStartYear;
    const y2 = filters.dateRangeEndYear;
    if (typeof y1 === "number" && Number.isFinite(y1)) {
      out.eventDateStart = `${Math.trunc(y1)}-01-01`;
    }
    if (typeof y2 === "number" && Number.isFinite(y2)) {
      out.eventDateEnd = `${Math.trunc(y2)}-12-31`;
    }
  }
  if (filters.locationEnabled) {
    const q = filters.locationQuery.trim();
    if (q.length > 0) {
      out.locationQuery = q;
    }
  }
  return out;
}

function parseYearFromIso(iso: string | null | undefined): number | null {
  if (iso == null || typeof iso !== "string") {
    return null;
  }
  const y = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function matchesEventYearQuickFilter(
  input: ThumbnailQuickFilterInput,
  filters: ThumbnailQuickFilterState,
): boolean {
  if (!filters.dateRangeEnabled) {
    return true;
  }
  const y1 = filters.dateRangeStartYear;
  const y2 = filters.dateRangeEndYear;
  if (y1 == null && y2 == null) {
    return true;
  }

  const itemStartY = parseYearFromIso(input.catalogEventDateStart);
  if (itemStartY === null) {
    return false;
  }
  const itemEndY = parseYearFromIso(input.catalogEventDateEnd ?? input.catalogEventDateStart);
  const rangeStart = itemStartY;
  const rangeEnd = itemEndY ?? itemStartY;

  const filterLow = typeof y1 === "number" && Number.isFinite(y1) ? y1 : Number.NEGATIVE_INFINITY;
  const filterHigh = typeof y2 === "number" && Number.isFinite(y2) ? y2 : Number.POSITIVE_INFINITY;

  return rangeStart <= filterHigh && rangeEnd >= filterLow;
}

function matchesLocationQuickFilter(
  input: ThumbnailQuickFilterInput,
  filters: ThumbnailQuickFilterState,
): boolean {
  if (!filters.locationEnabled) {
    return true;
  }
  const q = filters.locationQuery.trim().toLowerCase();
  if (q.length === 0) {
    return true;
  }
  const hay = [
    input.catalogCountry,
    input.catalogCity,
    input.catalogLocationArea,
    input.catalogLocationPlace,
    input.catalogLocationName,
  ]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function derivePeopleCount(input: ThumbnailQuickFilterInput): number | null {
  const aiPeopleCount = getNumberOfPeople(input.metadata);
  if (typeof aiPeopleCount === "number" && Number.isFinite(aiPeopleCount) && aiPeopleCount >= 0) {
    return aiPeopleCount;
  }

  if (typeof input.detectedFaceCount === "number" && Number.isFinite(input.detectedFaceCount) && input.detectedFaceCount >= 0) {
    return input.detectedFaceCount;
  }

  const semanticPeople = input.semanticPeopleDetected;
  if (typeof semanticPeople === "number" && Number.isFinite(semanticPeople) && semanticPeople >= 0) {
    return Math.floor(semanticPeople);
  }

  const faceDetectionMethod = getFaceDetectionMethod(input.metadata);
  if (!faceDetectionMethod) {
    return null;
  }

  return getPeopleBoundingBoxes(input.metadata).length;
}

function matchesPeopleFilter(
  peopleCount: number | null,
  filters: ThumbnailQuickFilterState,
): boolean {
  if (!filters.peopleEnabled) {
    return true;
  }

  if (peopleCount === null) {
    return false;
  }

  switch (filters.people) {
    case "none":
      return peopleCount === 0;
    case "gte_1":
      return peopleCount >= 1;
    case "eq_1":
      return peopleCount === 1;
    case "gte_2":
      return peopleCount >= 2;
    case "eq_2":
      return peopleCount === 2;
    case "gte_3":
      return peopleCount >= 3;
    case "eq_3":
      return peopleCount === 3;
    case "gte_4":
      return peopleCount >= 4;
    case "eq_4":
      return peopleCount === 4;
    case "gte_5":
      return peopleCount >= 5;
    case "eq_5":
      return peopleCount === 5;
    default:
      return true;
  }
}

function matchesRatingBandFilter(
  stars: number | null,
  filter: ThumbnailRatingBandQuickFilter,
  enabled: boolean,
): boolean {
  if (!enabled) {
    return true;
  }
  if (filter === "unrated") {
    return stars === null;
  }
  if (stars === null) {
    return false;
  }
  if (filter === "eq_1") return stars === 1;
  if (filter === "eq_2") return stars === 2;
  if (filter === "eq_3") return stars === 3;
  if (filter === "eq_4") return stars === 4;
  if (filter === "eq_5") return stars === 5;
  if (filter === "gte_1") return stars >= 1;
  if (filter === "gte_2") return stars >= 2;
  if (filter === "gte_3") return stars >= 3;
  if (filter === "gte_4") return stars >= 4;
  return false;
}

function matchesCategoryDimensionFilter(
  category: MediaImageCategory | null,
  filters: ThumbnailQuickFilterState,
): boolean {
  if (!filters.categoriesEnabled) {
    return true;
  }
  if (!category) {
    return false;
  }
  const option = getThumbnailCategoryOption(filters.category);
  return option ? option.categories.includes(category) : false;
}

function matchesDocumentsFilter(
  category: MediaImageCategory | null,
  enabled: boolean,
  selected: ThumbnailDocumentsQuickFilter,
): boolean {
  if (!enabled) {
    return true;
  }
  if (!category) {
    return false;
  }
  if (selected === "all") {
    return THUMBNAIL_ALL_DOCUMENT_CATEGORIES.has(category);
  }
  const option = getThumbnailDocumentOption(selected);
  return option ? option.categories.includes(category) : false;
}

function normalizeQuality(metadata: unknown): number | null {
  const normalized = normalizeMetadata(metadata);
  const aiQuality = normalized.ai?.photo_estetic_quality;
  if (typeof aiQuality === "number" && Number.isFinite(aiQuality)) {
    return Math.max(1, Math.min(10, aiQuality));
  }

  const extras = getAdditionalTopLevelFields(metadata);
  const rawQuality =
    typeof extras.photo_estetic_quality === "number" && Number.isFinite(extras.photo_estetic_quality)
      ? extras.photo_estetic_quality
      : null;

  if (rawQuality === null) {
    return null;
  }

  return Math.max(1, Math.min(10, rawQuality));
}
