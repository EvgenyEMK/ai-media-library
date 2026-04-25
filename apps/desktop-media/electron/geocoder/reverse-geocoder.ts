import { createRequire } from "node:module";
import fs from "node:fs";
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

const GEOCODER_CACHE_DATASETS = [
  { dirName: "cities1000", baseName: "cities1000" },
  { dirName: "admin1_codes", baseName: "admin1CodesASCII" },
];

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

function getGeocoderDumpDir(userDataPath: string): string {
  return path.join(userDataPath, "geonames");
}

function getCachedDatasetPath(datasetDir: string, baseName: string): string | null {
  const barePath = path.join(datasetDir, `${baseName}.txt`);
  if (fs.existsSync(barePath)) {
    return barePath;
  }
  if (!fs.existsSync(datasetDir)) {
    return null;
  }
  const datedPattern = new RegExp(`^${baseName}_\\d{4}-\\d{2}-\\d{2}\\.txt$`);
  const datedFiles = fs
    .readdirSync(datasetDir)
    .filter((fileName) => datedPattern.test(fileName))
    .sort()
    .reverse();
  return datedFiles.length > 0 ? path.join(datasetDir, datedFiles[0]) : null;
}

/**
 * local-reverse-geocoder refreshes dated cache files daily. For the desktop app,
 * keep an already-downloaded GeoNames cache stable so later scans do not pull
 * the same large files again.
 */
function stabilizeCachedGeocoderData(dumpDir: string): boolean {
  let allRequiredDataCached = true;
  for (const { dirName, baseName } of GEOCODER_CACHE_DATASETS) {
    const datasetDir = path.join(dumpDir, dirName);
    const barePath = path.join(datasetDir, `${baseName}.txt`);
    if (fs.existsSync(barePath)) {
      continue;
    }
    const cachedPath = getCachedDatasetPath(datasetDir, baseName);
    if (!cachedPath) {
      allRequiredDataCached = false;
      continue;
    }
    fs.renameSync(cachedPath, barePath);
  }
  return allRequiredDataCached;
}

export function hasCachedGeocoderData(userDataPath: string): boolean {
  return GEOCODER_CACHE_DATASETS.every(({ dirName, baseName }) =>
    getCachedDatasetPath(path.join(getGeocoderDumpDir(userDataPath), dirName), baseName) !== null,
  );
}

function clearCachedGeocoderData(dumpDir: string): void {
  for (const { dirName } of GEOCODER_CACHE_DATASETS) {
    fs.rmSync(path.join(dumpDir, dirName), { recursive: true, force: true });
  }
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
export async function initGeocoder(
  userDataPath: string,
  options: { forceRefresh?: boolean } = {},
): Promise<void> {
  if ((geocoderReady && options.forceRefresh !== true) || geocoderInitializing) return;
  geocoderInitializing = true;
  geocoderError = null;

  /** Playwright E2E only: same IPC/progress events without fetching GeoNames. */
  if (shouldUseE2eGeocoderStub()) {
    try {
      emitStatus(hasCachedGeocoderData(userDataPath) ? "loading-cache" : "downloading");
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

  try {
    const dumpDir = getGeocoderDumpDir(userDataPath);
    if (options.forceRefresh === true) {
      clearCachedGeocoderData(dumpDir);
    }
    const usingCachedData = options.forceRefresh === true ? false : stabilizeCachedGeocoderData(dumpDir);
    emitStatus(usingCachedData ? "loading-cache" : "downloading");
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
        emitStatus(usingCachedData ? "loading-cache" : "downloading");
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
    console.log(
      `[geocoder] initialization complete source=${usingCachedData ? "cache" : "download-or-refresh"}`,
    );
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
