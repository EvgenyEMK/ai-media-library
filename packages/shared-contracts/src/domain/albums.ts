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
  | "ai-countries"
  | "best-of-year";

export type SmartAlbumPlaceGrouping = "year-city" | "area-city";
export type SmartAlbumPlaceSource = "gps" | "non-gps";

export interface SmartAlbumPlacesRequest {
  grouping: SmartAlbumPlaceGrouping;
  source: SmartAlbumPlaceSource;
}

export interface SmartAlbumPlaceEntry {
  id: string;
  country: string;
  city: string;
  group: string;
  label: string;
  mediaCount: number;
}

export interface SmartAlbumPlaceGroup {
  group: string;
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
  topStarRating: number | null;
  topAestheticScore: number | null;
  coverSourcePath: string | null;
  coverMediaKind: "image" | "video";
}

export interface SmartAlbumYearsResult {
  years: SmartAlbumYearSummary[];
}

export type SmartAlbumItemsRequest =
  | {
      kind: "place";
      country: string;
      city: string;
      group: string;
      grouping: SmartAlbumPlaceGrouping;
      source: SmartAlbumPlaceSource;
      offset?: number;
      limit?: number;
    }
  | {
      kind: "best-of-year";
      year: string;
      offset?: number;
      limit?: number;
      randomize?: boolean;
    };
