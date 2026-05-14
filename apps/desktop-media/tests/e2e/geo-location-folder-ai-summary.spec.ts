import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/app-fixture";
import { mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { enableGpsGeocodingSetting } from "./fixtures/folder-scanning-e2e-helpers";
import { mockFolderDialog } from "./fixtures/mock-dialog";

const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const GPS_FILES = ["20210721_172049.jpg"] as const;
const NO_GPS_FILES = ["20200910_151932.jpg"] as const;

function hasRequiredAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return [...GPS_FILES, ...NO_GPS_FILES].every((name) => fs.existsSync(path.join(e2ePhotosDir, name)));
}

function createTempLibraryWithFiles(names: readonly string[]): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-geo-summary-e2e-"));
  for (const name of names) {
    fs.copyFileSync(path.join(e2ePhotosDir, name), path.join(tempRoot, name));
  }
  return tempRoot;
}

function removeTempLibrary(folderPath: string): void {
  fs.rmSync(folderPath, { recursive: true, force: true });
}

async function waitForFullMetadataScan(mainWindow: Page, folderPath: string): Promise<void> {
  await mainWindow.evaluate(async (folderPathArg) => {
    const completion = new Promise<void>((resolve, reject) => {
      let jobId: string | null = null;
      const timer = window.setTimeout(() => {
        unsub();
        reject(new Error("Timed out waiting for metadata scan job-completed"));
      }, 180_000);
      const unsub = window.desktopApi.onMetadataScanProgress((event) => {
        if (event.type === "job-started" && event.folderPath === folderPathArg) {
          jobId = event.jobId;
          return;
        }
        if (event.type === "job-completed" && jobId !== null && event.jobId === jobId) {
          window.clearTimeout(timer);
          unsub();
          resolve();
        }
      });
    });
    const scanPromise = window.desktopApi.scanFolderMetadata({
      folderPath: folderPathArg,
      recursive: true,
    });
    await completion;
    await scanPromise;
  }, folderPath);
}

async function openFolderAiSummary(mainWindow: Page, folderButtonName: string): Promise<void> {
  await mainWindow.getByRole("button", { name: folderButtonName, exact: true }).click({ button: "right" });
  await mainWindow
    .locator("[data-sidebar-tree-menu]")
    .getByRole("button", { name: "Folder AI analysis summary", exact: true })
    .click();
  // Flat libraries use "Folder analysis summary"; trees with subfolders use "Folder tree analysis summary".
  const folderOnlyHeading = mainWindow.getByRole("heading", { name: "Folder analysis summary" });
  const treeHeading = mainWindow.getByRole("heading", { name: "Folder tree analysis summary" });
  await expect(folderOnlyHeading.or(treeHeading)).toBeVisible();
}

test.use({ e2eGeocoderStub: true });

test.describe("Folder AI summary — Geo-location card", () => {
  test.setTimeout(300_000);

  test("Play completes after full scan (GPS fixtures): pipeline finishes and Play becomes idle", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(!hasRequiredAssets(), `Missing GPS metadata test assets in: ${e2ePhotosDir}`);
    const photoLibrary = createTempLibraryWithFiles([...GPS_FILES, ...NO_GPS_FILES]);

    try {
      await mockFolderDialog(electronApp, photoLibrary);
      await mainWindow.getByRole("button", { name: "Add library folder" }).click();
      await enableGpsGeocodingSetting(mainWindow, [photoLibrary]);

      await waitForFullMetadataScan(mainWindow, photoLibrary);

      const normalizedRoot = path.normalize(photoLibrary);
      const sidebar = mainDesktopSidebar(mainWindow);
      await sidebar.getByRole("button", { name: normalizedRoot, exact: true }).click();

      await openFolderAiSummary(mainWindow, normalizedRoot);

      const geoCard = mainWindow.getByRole("heading", { name: "Geo-location", exact: true }).locator("xpath=ancestor::section[1]");
      await expect(geoCard.getByText("Files with GPS")).toBeVisible();

      await geoCard.getByRole("button", { name: "Run geo-location extraction" }).click();

      // Geo-location often completes quickly on the stub; assert terminal idle state rather than a fleeting "running" label.
      await expect(geoCard.getByRole("button", { name: "Run geo-location extraction" })).toBeVisible({
        timeout: 120_000,
      });
    } finally {
      removeTempLibrary(photoLibrary);
    }
  });

  test("Play completes when folder has no GPS images", async ({ electronApp, mainWindow }) => {
    test.skip(!hasRequiredAssets(), `Missing test assets in: ${e2ePhotosDir}`);
    const photoLibrary = createTempLibraryWithFiles([...NO_GPS_FILES]);

    try {
      await mockFolderDialog(electronApp, photoLibrary);
      await mainWindow.getByRole("button", { name: "Add library folder" }).click();
      await enableGpsGeocodingSetting(mainWindow, [photoLibrary]);

      await waitForFullMetadataScan(mainWindow, photoLibrary);

      const normalizedRoot = path.normalize(photoLibrary);
      const sidebar = mainDesktopSidebar(mainWindow);
      await sidebar.getByRole("button", { name: normalizedRoot, exact: true }).click();

      await openFolderAiSummary(mainWindow, normalizedRoot);

      const geoCard = mainWindow.getByRole("heading", { name: "Geo-location", exact: true }).locator("xpath=ancestor::section[1]");
      await expect(geoCard.getByText(/Files with GPS/)).toBeVisible();
      await expect(geoCard).not.toContainText("Location extracted");

      // With zero GPS files there is nothing to geocode — the dashboard omits the geo Play control (see DesktopFolderAiSummaryView).
      await expect(geoCard.getByRole("button", { name: "Run geo-location extraction" })).toHaveCount(0);
    } finally {
      removeTempLibrary(photoLibrary);
    }
  });

  test("Geo Play still runs when folder tree scan is partial (only subfolder scanned)", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(!hasRequiredAssets(), `Missing GPS metadata test assets in: ${e2ePhotosDir}`);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-geo-partial-e2e-"));
    const subOnly = path.join(tempRoot, "only-here");
    fs.mkdirSync(subOnly, { recursive: true });
    for (const name of GPS_FILES) {
      fs.copyFileSync(path.join(e2ePhotosDir, name), path.join(subOnly, name));
    }

    try {
      await mockFolderDialog(electronApp, tempRoot);
      await mainWindow.getByRole("button", { name: "Add library folder" }).click();
      await enableGpsGeocodingSetting(mainWindow, [tempRoot]);

      await waitForFullMetadataScan(mainWindow, subOnly);

      const normalizedRoot = path.normalize(tempRoot);
      const sidebar = mainDesktopSidebar(mainWindow);
      await sidebar.getByRole("button", { name: normalizedRoot, exact: true }).click();

      await openFolderAiSummary(mainWindow, normalizedRoot);

      await expect(mainWindow.getByRole("heading", { name: "Folder tree scan" })).toBeVisible();

      const geoCard = mainWindow.getByRole("heading", { name: "Geo-location", exact: true }).locator("xpath=ancestor::section[1]");
      await geoCard.getByRole("button", { name: "Run geo-location extraction" }).click();
      await expect(geoCard.getByRole("button", { name: "Run geo-location extraction" })).toBeVisible({
        timeout: 120_000,
      });
    } finally {
      removeTempLibrary(tempRoot);
    }
  });
});
