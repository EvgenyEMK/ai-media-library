import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import type { GeocodedLocation } from "../geocoder/geocoder-types";

/** SQLite default SQLITE_MAX_VARIABLE_NUMBER is often 999; keep IN lists under that (incl. library_id). */
const GPS_GEOCODING_QUERY_CHUNK = 900;

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
         location_area2 = ?,
         location_source = 'gps',
         updated_at = ?
     WHERE id = ? AND library_id = ?
       AND (
         location_source IS NULL
         OR location_source NOT IN ('gps')
         OR (
           location_source = 'gps'
           AND (
             country IS NOT ?
             OR city IS NOT ?
             OR location_area IS NOT ?
             OR location_area2 IS NOT ?
           )
         )
       )`,
    )
    .run(
      location.countryName,
      location.cityName,
      location.admin1Name,
      location.admin2Name,
      new Date().toISOString(),
      mediaItemId,
      libraryId,
      location.countryName,
      location.cityName,
      location.admin1Name,
      location.admin2Name,
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
 * Query media items that have GPS coordinates and need geocoding: no GPS catalog row yet,
 * or GPS row missing country/state/city. GeoNames admin2/county is optional for many locations.
 * Used during the metadata scan geocoding phase.
 */
export function getMediaItemsNeedingGpsGeocoding(
  mediaItemIds: string[],
  libraryId: string = DEFAULT_LIBRARY_ID,
): GpsMediaItemRow[] {
  if (mediaItemIds.length === 0) return [];
  const db = getDesktopDatabase();
  const rows: GpsMediaItemRow[] = [];

  for (let i = 0; i < mediaItemIds.length; i += GPS_GEOCODING_QUERY_CHUNK) {
    const chunk = mediaItemIds.slice(i, i + GPS_GEOCODING_QUERY_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const found = db
      .prepare(
        `SELECT id, source_path, latitude, longitude
         FROM media_items
         WHERE library_id = ?
           AND id IN (${placeholders})
           AND latitude IS NOT NULL
           AND longitude IS NOT NULL
           AND (
             (location_source IS NULL OR location_source <> 'gps')
             OR (
               location_source = 'gps'
               AND (
                 country IS NULL
                 OR location_area IS NULL
                 OR city IS NULL
               )
             )
           )`,
      )
      .all(libraryId, ...chunk) as GpsMediaItemRow[];
    rows.push(...found);
  }

  return rows;
}
