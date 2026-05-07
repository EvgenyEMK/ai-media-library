import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "../e2e/fixtures/app-fixture";

const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const realGeocoderRuntimeRoot =
  process.env.EMK_E2E_REAL_GEOCODER_RUNTIME_ROOT?.trim() ||
  path.join(os.homedir(), ".emk-desktop-media-e2e-real-geocoder");

const forceRefresh = process.env.EMK_E2E_REAL_GEOCODER_FORCE_REFRESH === "1";

const GPS_FILES = ["20210721_172049.jpg", "20210724_074059.jpg"] as const;
const EXPECTED_COUNTRIES = /Montenegro|Switzerland/;

interface GeocoderInitSummary {
  hadLocalCopyBefore: boolean;
  hasLocalCopyAfter: boolean;
  statuses: string[];
}

interface LocatedMediaItemSnapshot {
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  city: string | null;
  locationSource: string | null;
}

function hasRequiredAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return GPS_FILES.every((name) => fs.existsSync(path.join(e2ePhotosDir, name)));
}

function createTempPhotoLibrary(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-real-geo-e2e-"));
  for (const name of GPS_FILES) {
    fs.copyFileSync(path.join(e2ePhotosDir, name), path.join(tempRoot, name));
  }
  return tempRoot;
}

function removeTempPhotoLibrary(folderPath: string): void {
  fs.rmSync(folderPath, { recursive: true, force: true });
}

async function initializeRealGeocoder(mainWindow: Page): Promise<GeocoderInitSummary> {
  return mainWindow.evaluate(async (forceRefresh) => {
    const before = await window.desktopApi.getGeocoderCacheStatus();
    const statuses: string[] = [];
    const unsubscribe = window.desktopApi.onGeocoderInitProgress((event) => {
      statuses.push(event.status);
    });

    try {
      await window.desktopApi.initGeocoder({ forceRefresh });
    } finally {
      unsubscribe();
    }

    const after = await window.desktopApi.getGeocoderCacheStatus();
    return {
      hadLocalCopyBefore: before.hasLocalCopy,
      hasLocalCopyAfter: after.hasLocalCopy,
      statuses,
    };
  }, forceRefresh);
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

async function scanPhotoLibrary(mainWindow: Page, folderPath: string): Promise<void> {
  await mainWindow.evaluate(async (folderPath) => {
    await window.desktopApi.scanFolderMetadata({
      folderPath,
      recursive: false,
    });
  }, folderPath);
}

async function resolveFixturePaths(mainWindow: Page, folderPath: string): Promise<Record<string, string>> {
  return mainWindow.evaluate(async (folderPath) => {
    const images = await window.desktopApi.listFolderImages(folderPath);
    return Object.fromEntries(images.map((image) => [image.name, image.path]));
  }, folderPath);
}

async function getLocatedItemsByPath(
  mainWindow: Page,
  paths: string[],
): Promise<Record<string, LocatedMediaItemSnapshot | undefined>> {
  return mainWindow.evaluate(async (paths) => {
    const itemsByPath = await window.desktopApi.getMediaItemsByPaths(paths);
    return Object.fromEntries(
      paths.map((filePath) => {
        const item = itemsByPath[filePath];
        return [
          filePath,
          item
            ? {
                latitude: item.latitude,
                longitude: item.longitude,
                country: item.country,
                city: item.city,
                locationSource: item.locationSource,
              }
            : undefined,
        ];
      }),
    );
  }, paths);
}

test.use({
  e2eRuntimeRootPath: realGeocoderRuntimeRoot,
  e2eSkipStartupAiModelsDownload: true,
});

test.describe("Real GeoNames GPS geocoding", () => {
  test("downloads real GeoNames data and resolves GPS coordinates to country and city", async ({
    mainWindow,
  }) => {
    test.skip(!hasRequiredAssets(), `Missing GPS metadata test assets in: ${e2ePhotosDir}`);
    const photoLibrary = createTempPhotoLibrary();

    try {
      const geocoderInit = await initializeRealGeocoder(mainWindow);
      expect(geocoderInit.hasLocalCopyAfter).toBe(true);
      if (!geocoderInit.hadLocalCopyBefore || forceRefresh) {
        expect(geocoderInit.statuses).toContain("downloading");
      }
      expect(geocoderInit.statuses).toContain("ready");

      await enableGpsGeocoding(mainWindow);
      await scanPhotoLibrary(mainWindow, photoLibrary);

      const pathsByName = await resolveFixturePaths(mainWindow, photoLibrary);
      const gpsPaths = GPS_FILES.map((name) => pathsByName[name]);
      if (!gpsPaths.every((filePath): filePath is string => Boolean(filePath))) {
        throw new Error("Failed to resolve all GPS fixture paths through Electron file listing.");
      }

      const itemsByPath = await getLocatedItemsByPath(mainWindow, gpsPaths);
      for (const filePath of gpsPaths) {
        const item = itemsByPath[filePath];
        expect(item?.latitude).not.toBeNull();
        expect(item?.longitude).not.toBeNull();
        expect(item?.country).toMatch(EXPECTED_COUNTRIES);
        expect(item?.city).toEqual(expect.stringMatching(/\S/));
        expect(item?.locationSource).toBe("gps");
      }
    } finally {
      removeTempPhotoLibrary(photoLibrary);
    }
  });
});
