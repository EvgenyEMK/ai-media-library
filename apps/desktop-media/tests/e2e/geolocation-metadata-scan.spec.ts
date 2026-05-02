import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/app-fixture";

const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const GPS_FILES = [
  "20210721_172049.jpg",
  "20210724_074059.jpg",
  "receipt-mock-02-french.jpg",
] as const;
const NO_GPS_FILES = ["20200910_151932.jpg"] as const;

interface GeocodingPhaseEventSnapshot {
  processed: number;
  total: number;
  geoDataUpdated: number;
}

interface ScanSnapshot {
  created: number;
  updated: number;
  unchanged: number;
  geoDataUpdated: number;
  geocodingPhases: GeocodingPhaseEventSnapshot[];
}

function hasRequiredAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return [...GPS_FILES, ...NO_GPS_FILES].every((name) =>
    fs.existsSync(path.join(e2ePhotosDir, name)),
  );
}

async function enableGpsGeocoding(mainWindow: Page): Promise<void> {
  await mainWindow.evaluate(async () => {
    const settings = await window.desktopApi.getSettings();
    await window.desktopApi.saveSettings({
      ...settings,
      folderScanning: {
        ...settings.folderScanning,
        detectLocationFromGps: true,
      },
    });
  });
}

function createTempPhotoLibrary(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-geo-e2e-"));
  fs.cpSync(e2ePhotosDir, tempRoot, { recursive: true });
  return tempRoot;
}

function removeTempPhotoLibrary(folderPath: string): void {
  fs.rmSync(folderPath, { recursive: true, force: true });
}

async function runMetadataScan(mainWindow: Page, folderPath: string): Promise<ScanSnapshot> {
  return mainWindow.evaluate(async (folderPath) => {
    let scanJobId: string | null = null;
    const geocodingPhases: GeocodingPhaseEventSnapshot[] = [];
    const completion = new Promise<ScanSnapshot>((resolve) => {
      const unsubscribe = window.desktopApi.onMetadataScanProgress((event) => {
        if (event.type === "job-started" && event.folderPath === folderPath) {
          scanJobId = event.jobId;
          return;
        }
        if (scanJobId === null || event.jobId !== scanJobId) return;
        if (event.type === "phase-updated" && event.phase === "geocoding") {
          geocodingPhases.push({
            processed: event.processed,
            total: event.total,
            geoDataUpdated: event.geoDataUpdated ?? 0,
          });
          return;
        }
        if (event.type === "job-completed") {
          unsubscribe();
          resolve({
            created: event.created,
            updated: event.updated,
            unchanged: event.unchanged,
            geoDataUpdated: event.geoDataUpdated,
            geocodingPhases,
          });
        }
      });
    });

    const scan = window.desktopApi.scanFolderMetadata({
      folderPath,
      recursive: false,
    });
    const result = await completion;
    await scan;
    return result;
  }, folderPath);
}

async function resolveFixturePaths(mainWindow: Page, folderPath: string): Promise<Record<string, string>> {
  return mainWindow.evaluate(async (folderPath) => {
    const images = await window.desktopApi.listFolderImages(folderPath);
    return Object.fromEntries(images.map((image) => [image.name, image.path]));
  }, folderPath);
}

test.use({ e2eGeocoderStub: true });

test.describe("GPS geolocation metadata scan", () => {
  /** Cold metadata + geocode under full-suite load can exceed the default 180s. */
  test.setTimeout(300_000);

  test("geocodes only GPS images and reports zero geo updates on repeat scan", async ({
    mainWindow,
  }) => {
    test.skip(!hasRequiredAssets(), `Missing GPS metadata test assets in: ${e2ePhotosDir}`);
    const photoLibrary = createTempPhotoLibrary();

    try {
      await enableGpsGeocoding(mainWindow);

      const firstScan = await runMetadataScan(mainWindow, photoLibrary);
      expect(firstScan.geoDataUpdated).toBe(GPS_FILES.length);
      expect(firstScan.geocodingPhases.some((phase) => phase.total === GPS_FILES.length)).toBe(true);

      const pathsByName = await resolveFixturePaths(mainWindow, photoLibrary);
      const gpsPaths = GPS_FILES.map((name) => pathsByName[name]);
      const noGpsPaths = NO_GPS_FILES.map((name) => pathsByName[name]);
      const allPaths = [...gpsPaths, ...noGpsPaths];
      if (!allPaths.every((filePath): filePath is string => Boolean(filePath))) {
        throw new Error("Failed to resolve all GPS fixture paths through Electron file listing.");
      }
      const resolvedGpsPaths = gpsPaths.filter((filePath): filePath is string => Boolean(filePath));
      const resolvedNoGpsPaths = noGpsPaths.filter((filePath): filePath is string => Boolean(filePath));
      const resolvedPaths = [...resolvedGpsPaths, ...resolvedNoGpsPaths];

      const itemsByPath = await mainWindow.evaluate(
        async (paths) => window.desktopApi.getMediaItemsByPaths(paths),
        resolvedPaths,
      );

      for (const filePath of resolvedGpsPaths) {
        const item = itemsByPath[filePath];
        expect(item?.latitude).not.toBeNull();
        expect(item?.longitude).not.toBeNull();
        expect(item?.country).toMatch(/Montenegro|Switzerland/);
        expect(item?.city).toMatch(/Kotor|Geneva/);
        expect(item?.locationSource).toBe("gps");
      }

      for (const filePath of resolvedNoGpsPaths) {
        const item = itemsByPath[filePath];
        expect(item?.latitude).toBeNull();
        expect(item?.longitude).toBeNull();
        expect(item?.country).toBeNull();
        expect(item?.city).toBeNull();
        expect(item?.locationSource).not.toBe("gps");
      }

      const secondScan = await runMetadataScan(mainWindow, photoLibrary);
      expect(secondScan.created).toBe(0);
      expect(secondScan.updated).toBe(0);
      expect(secondScan.geoDataUpdated).toBe(0);
      expect(secondScan.geocodingPhases.some((phase) => phase.total === 0)).toBe(true);
    } finally {
      removeTempPhotoLibrary(photoLibrary);
    }
  });
});
