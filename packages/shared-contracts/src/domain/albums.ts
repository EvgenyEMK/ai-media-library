export interface AlbumPersonTagSummary {
  id: string;
  label: string;
  source: "direct" | "computed" | "both";
}

export interface MediaAlbumSummary {
  id: string;
  title: string;
  description: string | null;
  coverMediaItemId: string | null;
  coverSourcePath: string | null;
  coverImageUrl: string | null;
  coverMediaKind: "image" | "video";
  mediaCount: number;
  locationSummary: string | null;
  personTags: AlbumPersonTagSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface AlbumListFilters {
  titleQuery?: string;
  locationQuery?: string;
  personTagIds?: string[];
  /** When true and `personTagIds` is set, match albums linked via suggestions as well as confirmed faces. */
  includeUnconfirmedFaces?: boolean;
  yearMonthFrom?: string;
  yearMonthTo?: string;
}

export interface AlbumListRequest extends AlbumListFilters {
  offset?: number;
  limit?: number;
}

export interface AlbumListResult {
  rows: MediaAlbumSummary[];
  totalCount: number;
}

export interface AlbumMediaItem {
  id: string;
  sourcePath: string;
  title: string;
  imageUrl: string;
  mediaKind: "image" | "video";
  starRating: number | null;
  width: number | null;
  height: number | null;
}

export interface AlbumItemsRequest {
  albumId: string;
  offset?: number;
  limit?: number;
}

export interface AlbumItemsResult {
  rows: AlbumMediaItem[];
  totalCount: number;
}

export interface AlbumMembership {
  albumId: string;
  title: string;
}

export type SmartAlbumRootKind =
  | "country-year-city"
  | "country-area-city"
  | "country-month-area"
  | "ai-countries"
  | "best-of-year";

export type SmartAlbumPlaceGrouping = "year-city" | "area-city" | "month-area";
export type SmartAlbumPlaceSource = "gps" | "non-gps";

/** Default AI `image_category` glob/literal patterns omitted from smart album queries (app settings; merged by the client). */
export const DEFAULT_SMART_ALBUM_EXCLUDED_IMAGE_CATEGORIES = [
  "document*",
  "*screenshot*",
  "invoice_or_receipt",
  "presentation_slide",
  "diagram",
] as const;

export interface SmartAlbumFilters {
  query?: string;
  personTagIds?: string[];
  includeUnconfirmedFaces?: boolean;
  starRatingMin?: number;
  starRatingOperator?: "gte" | "eq";
  aiAestheticMin?: number;
  aiAestheticOperator?: "gte" | "eq";
  ratingLogic?: "or" | "and";
  dateFrom?: string;
  dateTo?: string;
  /**
   * When set, smart album SQL excludes rows whose AI image category matches any of these patterns
   * (`*` → SQL `LIKE` `%`). Omitted on the request uses {@link DEFAULT_SMART_ALBUM_EXCLUDED_IMAGE_CATEGORIES}.
   */
  excludedImageCategories?: string[];
}

export interface SmartAlbumPlacesRequest {
  grouping: SmartAlbumPlaceGrouping;
  source: SmartAlbumPlaceSource;
  filters?: SmartAlbumFilters;
  consolidateMonthAreaThreshold?: number;
}

export interface SmartAlbumPlaceEntry {
  id: string;
  country: string;
  city: string;
  group: string;
  /** When grouping is area-city and admin2 is present: admin1 (state/province) for display as "Admin2 (Admin1)". */
  groupParent?: string | null;
  /** Canonical area1 (admin1) for area-city trees. */
  area1?: string | null;
  /** Canonical area2 (admin2 or fallback to area1) for area-city trees. */
  area2?: string | null;
  /** Which hierarchy level this entry represents when opened as an album leaf. */
  leafLevel?: "area1" | "area2" | "city";
  label: string;
  mediaCount: number;
}

export interface SmartAlbumPlaceGroup {
  group: string;
  /** Same as entry.groupParent when grouping is area-city (admin1 alongside admin2 group key). */
  groupParent?: string | null;
  mediaCount: number;
  entries: SmartAlbumPlaceEntry[];
}

export interface SmartAlbumPlaceCountry {
  country: string;
  mediaCount: number;
  groups: SmartAlbumPlaceGroup[];
}

export interface SmartAlbumPlacesResult {
  countries: SmartAlbumPlaceCountry[];
}

export interface SmartAlbumYearSummary {
  year: string;
  mediaCount: number;
  manualRatedCount: number;
  aiRatedCount: number;
  coverSourcePath: string | null;
  coverMediaKind: "image" | "video";
}

export interface SmartAlbumYearsResult {
  years: SmartAlbumYearSummary[];
}

export interface SmartAlbumYearsRequest {
  filters?: SmartAlbumFilters;
}

export type SmartAlbumItemsRequest =
  | {
      kind: "place";
      country: string;
      city: string | null;
      group: string;
      grouping: SmartAlbumPlaceGrouping;
      source: SmartAlbumPlaceSource;
      /** Optional for area-city dynamic hierarchy leaves. */
      leafLevel?: "area1" | "area2" | "city";
      /** Optional for area-city dynamic hierarchy leaves. */
      area1?: string | null;
      /** Optional for area-city dynamic hierarchy leaves. */
      area2?: string | null;
      filters?: SmartAlbumFilters;
      offset?: number;
      limit?: number;
    }
  | {
      kind: "best-of-year";
      year: string;
      filters?: SmartAlbumFilters;
      offset?: number;
      limit?: number;
      randomize?: boolean;
      randomCandidateLimit?: number;
    };
