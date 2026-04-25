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
