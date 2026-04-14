import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import type { GeocodedLocation } from "../geocoder/geocoder-types";

/**
 * Persist reverse-geocoded GPS location to a media item.
 * Only writes if the current `location_source` is absent or lower priority than "gps".
 */
export function updateMediaItemLocationFromGps(
  mediaItemId: string,
  location: GeocodedLocation,
  libraryId: string = DEFAULT_LIBRARY_ID,
): number {
  const db = getDesktopDatabase();
  const result = db
    .prepare(
      `UPDATE media_items
     SET country = ?,
         city = ?,
         location_area = ?,
         location_source = 'gps',
         updated_at = ?
     WHERE id = ? AND library_id = ?
       AND (location_source IS NULL
            OR location_source NOT IN ('gps'))`,
    )
    .run(
      location.countryName,
      location.cityName,
      location.admin1Name,
      new Date().toISOString(),
      mediaItemId,
      libraryId,
    );
  return result.changes;
}

export interface GpsMediaItemRow {
  id: string;
  source_path: string;
  latitude: number;
  longitude: number;
}

/**
 * Query media items that have GPS coordinates but no GPS-sourced location yet.
 * Used during the metadata scan geocoding phase.
 */
export function getMediaItemsNeedingGpsGeocoding(
  mediaItemIds: string[],
  libraryId: string = DEFAULT_LIBRARY_ID,
): GpsMediaItemRow[] {
  if (mediaItemIds.length === 0) return [];
  const db = getDesktopDatabase();
  const placeholders = mediaItemIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT id, source_path, latitude, longitude
       FROM media_items
       WHERE library_id = ?
         AND id IN (${placeholders})
         AND latitude IS NOT NULL
         AND longitude IS NOT NULL
         AND (location_source IS NULL OR location_source != 'gps')`,
    )
    .all(libraryId, ...mediaItemIds) as GpsMediaItemRow[];
}
