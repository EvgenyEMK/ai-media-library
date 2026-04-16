export interface MediaSwiperViewerItem {
  id: string;
  title?: string | null;
  storage_url?: string | null;
  storage_path?: string | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  width?: number | null;
  height?: number | null;
  mediaType?: "image" | "video";
}

export interface MediaThumbnailGridItem {
  id: string;
  title: string;
  imageUrl?: string | null;
  subtitle?: string;
  /** Catalog / embedded: -1 rejected, 0 unrated, 1–5 stars; optional until loaded. */
  starRating?: number | null;
  onStarRatingChange?: (next: number) => void;
  /** Show rejected (-1) badge when star rating UI gains that mode. */
  starRatingShowRejected?: boolean;
  mediaType?: "image" | "video";
}
