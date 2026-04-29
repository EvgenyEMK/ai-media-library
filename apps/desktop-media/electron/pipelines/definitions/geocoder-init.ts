import { app } from "electron";
import { resolveGeonamesPath } from "../../app-paths";
import {
  hasCachedGeocoderData,
  initGeocoder,
  isGeocoderReady,
} from "../../geocoder/reverse-geocoder";
import type { PipelineDefinition } from "../pipeline-registry";

/**
 * Pipeline params for `geocoder-init`. Mirrors the legacy IPC handler.
 */
export interface GeocoderInitParams {
  /** Forces re-download of the GeoNames dataset even if a cached copy exists. */
  forceRefresh?: boolean;
}

/**
 * Result of preparing the offline reverse-geocoder. Useful as upstream output
 * for a chained `gps-geocode` job (which can short-circuit if the geocoder
 * could not be initialised).
 */
export interface GeocoderInitOutput {
  ready: boolean;
  hadCachedData: boolean;
  /** Resolved GeoNames data path on disk. */
  geonamesPath: string;
}

/**
 * Pipeline definition that wraps {@link initGeocoder} so it can run as part of
 * a bundle. Concurrency group is "io" (download + parse).
 *
 * Cancellation: `initGeocoder` itself does not currently honour an
 * AbortSignal, but the operation typically completes within seconds when
 * cached data exists. When a download is required, callers can dismiss the
 * resulting card; the underlying operation will finish in the background.
 */
export const geocoderInitDefinition: PipelineDefinition<GeocoderInitParams, GeocoderInitOutput> = {
  id: "geocoder-init",
  displayName: "Prepare offline geocoder",
  concurrencyGroup: "io",
  defaultParams: { forceRefresh: false },
  run: async (ctx, params) => {
    const geonamesPath = resolveGeonamesPath(app);
    const hadCachedData = hasCachedGeocoderData(geonamesPath);

    ctx.report({
      type: "started",
      message: hadCachedData ? "Loading cached GeoNames data" : "Downloading GeoNames data",
    });
    ctx.report({
      type: "phase-changed",
      phase: hadCachedData ? "loading-cache" : "downloading",
    });

    await initGeocoder(geonamesPath, { forceRefresh: params.forceRefresh === true });
    const ready = isGeocoderReady();

    ctx.report({
      type: "phase-changed",
      phase: ready ? "ready" : "error",
      message: ready ? "Offline geocoder ready" : "Geocoder failed to initialize",
    });

    return { ready, hadCachedData, geonamesPath };
  },
};
