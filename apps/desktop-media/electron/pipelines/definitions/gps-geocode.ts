import { app } from "electron";
import {
  hasCachedGeocoderData,
  initGeocoder,
  isGeocoderReady,
  reverseGeocodeBatch,
} from "../../geocoder/reverse-geocoder";
import {
  getAllMediaItemsNeedingGpsGeocoding,
  getMediaItemsNeedingGpsGeocoding,
  updateMediaItemLocationFromGps,
} from "../../db/media-item-geocoding";
import { resolveGeonamesPath } from "../../app-paths";
import type { PipelineDefinition } from "../pipeline-registry";

/**
 * Number of points per `reverseGeocodeBatch` call. Same value the legacy
 * inline phase in `runMetadataScanJob` used.
 */
const GPS_BATCH_SIZE = 500;

/**
 * Pipeline params for `gps-geocode`. Three modes:
 *   1. Explicit list of media item ids (used when chained behind
 *      `metadata-scan` via an `inputBinding`).
 *   2. `folderPath` + optional `recursive` (used by the `geo-only` preset).
 *   3. No filter — operates on every media item in the library that has GPS
 *      coordinates and is missing geocoded location data.
 */
export interface GpsGeocodeParams {
  mediaItemIds?: string[];
  folderPath?: string;
  recursive?: boolean;
}

/**
 * Result of a `gps-geocode` run. Useful for logging and bundle-completion UX
 * (e.g. "12 photos got country/city info").
 */
export interface GpsGeocodeOutput {
  /** Number of media items that were considered for geocoding. */
  considered: number;
  /** Number of media items where the geocoded location was actually written. */
  geoDataUpdated: number;
}

/**
 * Pipeline definition for GPS reverse geocoding. Replaces the inline GPS
 * phase that used to live inside `runMetadataScanJob`. Operates on a
 * caller-provided list of items, a folder, or the entire library.
 *
 * Concurrency group is "io" (CPU work plus filesystem reads against the
 * GeoNames cache).
 */
export const gpsGeocodeDefinition: PipelineDefinition<GpsGeocodeParams, GpsGeocodeOutput> = {
  id: "gps-geocode",
  displayName: "Reverse geocode GPS coordinates",
  concurrencyGroup: "io",
  defaultParams: { recursive: true },
  run: async (ctx, params) => {
    ctx.report({ type: "started" });

    let candidates;
    if (params.mediaItemIds && params.mediaItemIds.length > 0) {
      candidates = getMediaItemsNeedingGpsGeocoding(params.mediaItemIds);
    } else {
      candidates = getAllMediaItemsNeedingGpsGeocoding({
        folderPath: params.folderPath,
        recursive: params.recursive !== false,
      });
    }

    ctx.report({
      type: "phase-changed",
      phase: "geocoding",
      processed: 0,
      total: candidates.length,
    });

    if (candidates.length === 0) {
      return { considered: 0, geoDataUpdated: 0 };
    }

    const geonamesPath = resolveGeonamesPath(app);
    if (!isGeocoderReady()) {
      const cacheState = hasCachedGeocoderData(geonamesPath) ? "cache" : "download-or-refresh";
      ctx.report({
        type: "log",
        level: "info",
        message: `Geocoder not ready, initializing source=${cacheState}`,
      });
      await initGeocoder(geonamesPath);
    }
    if (!isGeocoderReady()) {
      ctx.report({
        type: "log",
        level: "warn",
        message: "Geocoder failed to initialize — skipping GPS geocoding",
      });
      return { considered: candidates.length, geoDataUpdated: 0 };
    }

    let processed = 0;
    let geoDataUpdated = 0;
    for (let i = 0; i < candidates.length; i += GPS_BATCH_SIZE) {
      if (ctx.signal.aborted) break;
      const batch = candidates.slice(i, i + GPS_BATCH_SIZE);
      const points = batch.map((row) => ({ latitude: row.latitude, longitude: row.longitude }));
      const results = await reverseGeocodeBatch(points);
      for (let j = 0; j < batch.length; j++) {
        const location = results[j];
        if (location) {
          geoDataUpdated += updateMediaItemLocationFromGps(batch[j]!.id, location);
        }
      }
      processed = Math.min(i + batch.length, candidates.length);
      ctx.report({
        type: "item-updated",
        processed,
        total: candidates.length,
        message: `Geocoded ${processed}/${candidates.length} (updated ${geoDataUpdated})`,
        details: { geoDataUpdated },
      });
    }

    return { considered: candidates.length, geoDataUpdated };
  },
};
