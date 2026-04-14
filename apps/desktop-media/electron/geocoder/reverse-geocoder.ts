import { createRequire } from "node:module";
import path from "node:path";
import type {
  GeoNameRecord,
  InitOptions,
  LookUpPoint,
} from "local-reverse-geocoder";
import type { GeocodedLocation, GeocoderStatus } from "./geocoder-types";
import { isoCountryName } from "./country-codes";

const requireGeocoder = createRequire(import.meta.url);

export type LocalReverseGeocoderModule = {
  init(options: InitOptions, callback: () => void): void;
  init(callback: () => void): void;
  lookUp(
    point: LookUpPoint | LookUpPoint[],
    maxResults: number,
    callback: (err: Error | null, results: GeoNameRecord[][]) => void,
  ): void;
  lookUp(
    point: LookUpPoint | LookUpPoint[],
    callback: (err: Error | null, results: GeoNameRecord[][]) => void,
  ): void;
};

type GeocoderModuleLoader = () => LocalReverseGeocoderModule;

let loadGeocoderModule: GeocoderModuleLoader = () =>
  requireGeocoder("local-reverse-geocoder") as LocalReverseGeocoderModule;

let geocoderModule: LocalReverseGeocoderModule | null = null;

function getGeocoder(): LocalReverseGeocoderModule {
  if (!geocoderModule) {
    geocoderModule = loadGeocoderModule();
  }
  return geocoderModule;
}

/**
 * Clears init/lookup cache and readiness flags. Optional `loader` replaces
 * the Node `require("local-reverse-geocoder")` path (used by unit tests because
 * Vitest does not intercept `createRequire` loads).
 */
export function resetGeocoderForTests(loader?: GeocoderModuleLoader): void {
  geocoderModule = null;
  geocoderReady = false;
  geocoderInitializing = false;
  geocoderError = null;
  loadGeocoderModule = loader ?? (() => requireGeocoder("local-reverse-geocoder") as LocalReverseGeocoderModule);
}

let geocoderReady = false;
let geocoderInitializing = false;
let geocoderError: string | null = null;
let statusListener: ((status: GeocoderStatus, error?: string) => void) | null = null;

function emitStatus(status: GeocoderStatus, error?: string): void {
  if (statusListener) {
    statusListener(status, error);
  }
}

export function onGeocoderStatusChange(
  listener: (status: GeocoderStatus, error?: string) => void,
): () => void {
  statusListener = listener;
  return () => {
    if (statusListener === listener) statusListener = null;
  };
}

export function isGeocoderReady(): boolean {
  return geocoderReady;
}

export function getGeocoderError(): string | null {
  return geocoderError;
}

/**
 * Playwright sets `EMK_E2E_GEOCODER_STUB=1` (see `app-fixture.ts`).
 * Do not combine with `process.env.NODE_ENV === "test"` — Vite production builds
 * inline NODE_ENV as `"production"`, which would strip the stub branch via DCE.
 */
function shouldUseE2eGeocoderStub(): boolean {
  return process.env.EMK_E2E_GEOCODER_STUB === "1";
}

/**
 * Lazily initialize the geocoder. Downloads ~2 GB of GeoNames data on first
 * run, then builds an in-memory k-d tree. Subsequent starts reuse cached files.
 *
 * We only load cities1000 + admin1 codes (no admin2/3/4, no alternate names)
 * to keep memory and download size reasonable.
 */
export async function initGeocoder(userDataPath: string): Promise<void> {
  if (geocoderReady || geocoderInitializing) return;
  geocoderInitializing = true;
  geocoderError = null;
  emitStatus("downloading");

  /** Playwright E2E only: same IPC/progress events without fetching GeoNames. */
  if (shouldUseE2eGeocoderStub()) {
    try {
      emitStatus("parsing");
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
      geocoderReady = true;
      geocoderInitializing = false;
      emitStatus("ready");
      console.log("[geocoder] E2E stub: skipped real GeoNames download");
      return;
    } catch (err) {
      geocoderInitializing = false;
      geocoderReady = false;
      const msg = err instanceof Error ? err.message : String(err);
      geocoderError = msg;
      emitStatus("error", msg);
      console.error("[geocoder] E2E stub failed:", msg);
      throw err;
    }
  }

  const dumpDir = path.join(userDataPath, "geonames");

  try {
    const geocoder = getGeocoder();

    const initOptions: InitOptions = {
      dumpDirectory: dumpDir,
      load: {
        admin1: true,
        admin2: false,
        admin3: false,
        admin4: false,
        alternateNames: false,
      },
    };

    await new Promise<void>((resolve, reject) => {
      try {
        emitStatus("downloading");
        geocoder.init(initOptions, () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });

    geocoderReady = true;
    geocoderInitializing = false;
    emitStatus("ready");
    console.log("[geocoder] initialization complete");
  } catch (err) {
    geocoderInitializing = false;
    geocoderReady = false;
    const msg = err instanceof Error ? err.message : String(err);
    geocoderError = msg;
    emitStatus("error", msg);
    console.error("[geocoder] initialization failed:", msg);
    throw err;
  }
}

/**
 * Reverse-geocode a single point. Returns the closest city with country
 * and admin1 (state/province) information, or null if the geocoder is not
 * ready or no result is found.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodedLocation | null> {
  if (!geocoderReady) return null;

  const geocoder = getGeocoder();
  const point: LookUpPoint = { latitude, longitude };

  return new Promise((resolve) => {
    geocoder.lookUp(point, 1, (err: Error | null, results: GeoNameRecord[][]) => {
      if (err || !results?.[0]?.[0]) {
        resolve(null);
        return;
      }
      const hit = results[0][0];
      resolve({
        countryCode: hit.countryCode,
        countryName: isoCountryName(hit.countryCode),
        admin1Name: hit.admin1Code?.name ?? null,
        cityName: hit.name,
        distance: hit.distance,
      });
    });
  });
}

/**
 * Batch reverse-geocode an array of points. Returns one result per input
 * point (null when lookup fails for that point).
 */
export async function reverseGeocodeBatch(
  points: Array<{ latitude: number; longitude: number }>,
): Promise<Array<GeocodedLocation | null>> {
  if (!geocoderReady || points.length === 0) {
    return points.map(() => null);
  }

  const geocoder = getGeocoder();

  return new Promise((resolve) => {
    geocoder.lookUp(points, 1, (err: Error | null, results: GeoNameRecord[][]) => {
      if (err || !results) {
        resolve(points.map(() => null));
        return;
      }
      const out = points.map((_, i) => {
        const hit = results[i]?.[0];
        if (!hit) return null;
        return {
          countryCode: hit.countryCode,
          countryName: isoCountryName(hit.countryCode),
          admin1Name: hit.admin1Code?.name ?? null,
          cityName: hit.name,
          distance: hit.distance,
        };
      });
      resolve(out);
    });
  });
}
