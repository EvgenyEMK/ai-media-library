import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type {
  GeoNameRecord,
  InitOptions,
  LookUpPoint,
} from "local-reverse-geocoder";
import type { GeocodedLocation, GeocoderInitProgress, GeocoderStatus } from "./geocoder-types";
import { isoCountryName } from "./country-codes";

function mapGeoNameHitToLocation(hit: GeoNameRecord): GeocodedLocation {
  return {
    countryCode: hit.countryCode,
    countryName: isoCountryName(hit.countryCode),
    admin1Name: hit.admin1Code?.name ?? null,
    admin2Name: hit.admin2Code?.name ?? null,
    cityName: hit.name,
    distance: hit.distance,
  };
}

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
let statusListener: ((progress: GeocoderInitProgress) => void) | null = null;
let downloadProgressInterval: NodeJS.Timeout | null = null;

const GEOCODER_CACHE_DATASETS = [
  { dirName: "cities1000", baseName: "cities1000" },
  { dirName: "admin1_codes", baseName: "admin1CodesASCII" },
  { dirName: "admin2_codes", baseName: "admin2CodesASCII" },
];

function datasetDownloadProgress(geonamesPath: string): { progressPercent: number; progressLabel: string } {
  const totalDatasets = GEOCODER_CACHE_DATASETS.length;
  const cachedDatasets = GEOCODER_CACHE_DATASETS.filter(
    ({ dirName, baseName }) => getCachedDatasetPath(path.join(geonamesPath, dirName), baseName) !== null,
  ).length;
  // Keep a small headroom for parse/finalize before "ready".
  const progressPercent = Math.min(95, Math.round((cachedDatasets / totalDatasets) * 95));
  return {
    progressPercent,
    progressLabel: `Downloaded datasets: ${cachedDatasets}/${totalDatasets}`,
  };
}

function stopDownloadProgressUpdates(): void {
  if (downloadProgressInterval) {
    clearInterval(downloadProgressInterval);
    downloadProgressInterval = null;
  }
}

function startDownloadProgressUpdates(geonamesPath: string): void {
  stopDownloadProgressUpdates();
  downloadProgressInterval = setInterval(() => {
    if (!geocoderInitializing) {
      stopDownloadProgressUpdates();
      return;
    }
    emitStatus("downloading", undefined, datasetDownloadProgress(geonamesPath));
  }, 700);
}

function emitStatus(
  status: GeocoderStatus,
  error?: string,
  extra?: Pick<GeocoderInitProgress, "progressPercent" | "progressLabel">,
): void {
  if (statusListener) {
    statusListener({ status, error, ...(extra ?? {}) });
  }
}

export function onGeocoderStatusChange(
  listener: (progress: GeocoderInitProgress) => void,
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

export function hasCachedGeocoderData(geonamesPath: string): boolean {
  return GEOCODER_CACHE_DATASETS.every(({ dirName, baseName }) =>
    getCachedDatasetPath(path.join(geonamesPath, dirName), baseName) !== null,
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

function createE2eStubLocation(
  latitude: number,
  longitude: number,
): GeocodedLocation {
  if (latitude > 45 && longitude > 5 && longitude < 7) {
    return {
      countryCode: "CH",
      countryName: "Switzerland",
      admin1Name: "Geneva",
      admin2Name: null,
      cityName: "Geneva",
      distance: 0,
    };
  }

  return {
    countryCode: "ME",
    countryName: "Montenegro",
    admin1Name: "Kotor",
    admin2Name: null,
    cityName: "Kotor",
    distance: 0,
  };
}

/**
 * Lazily initialize the geocoder. Downloads ~2 GB of GeoNames data on first
 * run, then builds an in-memory k-d tree. Subsequent starts reuse cached files.
 *
 * We load cities1000 + admin1 + admin2 codes (no admin3/4, no alternate names)
 * for county/district (admin2) alongside state/province (admin1).
 */
export async function initGeocoder(
  geonamesPath: string,
  options: { forceRefresh?: boolean } = {},
): Promise<void> {
  if ((geocoderReady && options.forceRefresh !== true) || geocoderInitializing) return;
  geocoderInitializing = true;
  geocoderError = null;
  stopDownloadProgressUpdates();

  /** Playwright E2E only: same IPC/progress events without fetching GeoNames. */
  if (shouldUseE2eGeocoderStub()) {
    try {
      emitStatus(hasCachedGeocoderData(geonamesPath) ? "loading-cache" : "downloading");
      emitStatus("parsing");
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
      geocoderReady = true;
      geocoderInitializing = false;
      stopDownloadProgressUpdates();
      emitStatus("ready");
      console.log("[geocoder] E2E stub: skipped real GeoNames download");
      return;
    } catch (err) {
      geocoderInitializing = false;
      geocoderReady = false;
      stopDownloadProgressUpdates();
      const msg = err instanceof Error ? err.message : String(err);
      geocoderError = msg;
      emitStatus("error", msg);
      console.error("[geocoder] E2E stub failed:", msg);
      throw err;
    }
  }

  try {
    if (options.forceRefresh === true) {
      clearCachedGeocoderData(geonamesPath);
    }
    const usingCachedData = options.forceRefresh === true ? false : stabilizeCachedGeocoderData(geonamesPath);
    if (usingCachedData) {
      emitStatus("loading-cache", undefined, { progressPercent: 100, progressLabel: "Using cached GeoNames data" });
    } else {
      emitStatus("downloading", undefined, datasetDownloadProgress(geonamesPath));
      startDownloadProgressUpdates(geonamesPath);
    }
    const geocoder = getGeocoder();

    const initOptions: InitOptions = {
      dumpDirectory: geonamesPath,
      load: {
        admin1: true,
        admin2: true,
        admin3: false,
        admin4: false,
        alternateNames: false,
      },
    };

    await new Promise<void>((resolve, reject) => {
      try {
        if (usingCachedData) {
          emitStatus("loading-cache", undefined, {
            progressPercent: 100,
            progressLabel: "Using cached GeoNames data",
          });
        } else {
          emitStatus("downloading", undefined, datasetDownloadProgress(geonamesPath));
        }
        geocoder.init(initOptions, () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });

    geocoderReady = true;
    geocoderInitializing = false;
    stopDownloadProgressUpdates();
    emitStatus("ready", undefined, { progressPercent: 100, progressLabel: "GeoNames data ready" });
    console.log(
      `[geocoder] initialization complete source=${usingCachedData ? "cache" : "download-or-refresh"}`,
    );
  } catch (err) {
    geocoderInitializing = false;
    geocoderReady = false;
    stopDownloadProgressUpdates();
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
  if (shouldUseE2eGeocoderStub()) return createE2eStubLocation(latitude, longitude);

  const geocoder = getGeocoder();
  const point: LookUpPoint = { latitude, longitude };

  return new Promise((resolve) => {
    geocoder.lookUp(point, 1, (err: Error | null, results: GeoNameRecord[][]) => {
      if (err || !results?.[0]?.[0]) {
        resolve(null);
        return;
      }
      const hit = results[0][0];
      resolve(mapGeoNameHitToLocation(hit));
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
  if (shouldUseE2eGeocoderStub()) {
    return points.map((point) => createE2eStubLocation(point.latitude, point.longitude));
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
        return mapGeoNameHitToLocation(hit);
      });
      resolve(out);
    });
  });
}
