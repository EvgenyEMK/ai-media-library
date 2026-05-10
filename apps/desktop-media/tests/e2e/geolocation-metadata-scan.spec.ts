import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/app-fixture";
import { enableGpsGeocodingSetting } from "./fixtures/folder-scanning-e2e-helpers";

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

type MetadataScanResultSnapshot = Omit<ScanSnapshot, "geocodingPhases">;

function hasRequiredAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return [...GPS_FILES, ...NO_GPS_FILES].every((name) =>
    fs.existsSync(path.join(e2ePhotosDir, name)),
  );
}

function createTempPhotoLibrary(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-geo-e2e-"));
  for (const name of [...GPS_FILES, ...NO_GPS_FILES]) {
    fs.copyFileSync(path.join(e2ePhotosDir, name), path.join(tempRoot, name));
  }
  return tempRoot;
}

function removeTempPhotoLibrary(folderPath: string): void {
  fs.rmSync(folderPath, { recursive: true, force: true });
}

async function runMetadataScan(mainWindow: Page, folderPath: string): Promise<ScanSnapshot> {
  return mainWindow.evaluate(async (folderPath) => {
    let scanJobId: string | null = null;
    const geocodingPhases: GeocodingPhaseEventSnapshot[] = [];
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
      }
    });

    try {
      const scanResult = (await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: false,
      })) as unknown as MetadataScanResultSnapshot;
      return {
        created: scanResult.created,
        updated: scanResult.updated,
        unchanged: scanResult.unchanged,
        geoDataUpdated: scanResult.geoDataUpdated,
        geocodingPhases,
      };
    } finally {
      unsubscribe();
    }
  }, folderPath);
}

async function runGpsGeocodePipeline(mainWindow: Page, folderPath: string): Promise<void> {
  await mainWindow.evaluate(async (folderPath) => {
    const result = await window.desktopApi.pipelines.enqueueBundle({
      kind: "single-job",
      payload: {
        pipelineId: "gps-geocode",
        displayName: `GPS geocode — ${folderPath}`,
        params: { folderPath, recursive: false },
      },
    });
    if (!result.ok) {
      throw new Error(`Failed to enqueue gps-geocode: ${JSON.stringify(result.rejection)}`);
    }
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const snapshot = await window.desktopApi.pipelines.getSnapshot();
      const recent = snapshot.recent.find((bundle) => bundle.bundleId === result.bundleId);
      if (recent) {
        if (recent.state === "failed" || recent.state === "cancelled") {
          throw new Error(`gps-geocode bundle ended as ${recent.state}`);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Timed out waiting for gps-geocode bundle to finish.");
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
      await enableGpsGeocodingSetting(mainWindow);

      const firstScan = await runMetadataScan(mainWindow, photoLibrary);
      if (firstScan.geocodingPhases.length > 0) {
        expect(firstScan.geocodingPhases.some((phase) => phase.total === GPS_FILES.length)).toBe(true);
      }

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

      let itemsByPath = await mainWindow.evaluate(
        async (paths) => window.desktopApi.getMediaItemsByPaths(paths),
        resolvedPaths,
      );
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const allGpsLocated = resolvedGpsPaths.every((filePath) => {
          const item = itemsByPath[filePath];
          return item?.country != null && item.city != null && item.locationSource === "gps";
        });
        if (allGpsLocated) break;
        await runGpsGeocodePipeline(mainWindow, photoLibrary);
        itemsByPath = await mainWindow.evaluate(
          async (paths) => window.desktopApi.getMediaItemsByPaths(paths),
          resolvedPaths,
        );
      }

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
      if (secondScan.geocodingPhases.length > 0) {
        expect(secondScan.geocodingPhases.some((phase) => phase.total === 0)).toBe(true);
      }
    } finally {
      removeTempPhotoLibrary(photoLibrary);
    }
  });
});
