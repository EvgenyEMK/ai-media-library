import { expect, test } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import {
  getFileMtimeMs,
  readWindowsExifRatingTags,
  shutdownExiftoolForE2E,
  waitUntilFileShowsStarRatingAndNewerMtime,
} from "./fixtures/read-embedded-star-rating";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

/** Embedded + ExifTool may need two writes in one test; allow generous headroom on cold runners. */
test.describe.configure({ mode: "serial", timeout: 300_000 });

/**
 * Use the exact path strings Electron uses when listing files so `source_path`
 * keys match `getMediaItemsByPaths` lookups (Node `path.join` alone can differ
 * subtly from the main-process FS paths on Windows).
 */
async function electronImagePath(
  mainWindow: import("@playwright/test").Page,
  folderPath: string,
  fileName: string,
): Promise<string> {
  const resolved = await mainWindow.evaluate(
    async ({ folder, name }) => {
      const imgs = await window.desktopApi.listFolderImages(folder);
      const hit = imgs.find((i) => i.name === name);
      return hit?.path ?? null;
    },
    { folder: folderPath, name: fileName },
  );
  expect(resolved, `Expected ${fileName} under ${folderPath}`).not.toBeNull();
  return resolved as string;
}

async function waitForCatalogItem(
  mainWindow: import("@playwright/test").Page,
  filePath: string,
): Promise<void> {
  await expect
    .poll(
      async () =>
        mainWindow.evaluate(async (p) => {
          const m = await window.desktopApi.getMediaItemsByPaths([p]);
          return m[p]?.id ?? null;
        }, filePath),
      { timeout: 90_000 },
    )
    .not.toBeNull();
}

async function enableWriteEmbeddedMetadata(mainWindow: import("@playwright/test").Page): Promise<void> {
  await mainWindow.evaluate(async () => {
    const s = await window.desktopApi.getSettings();
    await window.desktopApi.saveSettings({
      ...s,
      folderScanning: {
        ...s.folderScanning,
        writeEmbeddedMetadataOnUserEdit: true,
      },
    });
  });
}

async function disableWriteEmbeddedMetadata(mainWindow: import("@playwright/test").Page): Promise<void> {
  await mainWindow.evaluate(async () => {
    const s = await window.desktopApi.getSettings();
    await window.desktopApi.saveSettings({
      ...s,
      folderScanning: {
        ...s.folderScanning,
        writeEmbeddedMetadataOnUserEdit: false,
      },
    });
  });
}

async function addLibraryAndScan(
  electronApp: import("@playwright/test").ElectronApplication,
  mainWindow: import("@playwright/test").Page,
  folderPath: string,
): Promise<void> {
  await mockFolderDialog(electronApp, folderPath);
  await mainWindow.getByText("Add library folder").click();
  await clickSidebarLibraryRoot(mainWindow, folderPath);

  await mainWindow.evaluate(async (folder) => {
    await window.desktopApi.scanFolderMetadata({ folderPath: folder, recursive: false });
  }, folderPath);
}

test.describe("Star rating", () => {
  test("setMediaItemStarRating with embedded write off updates catalog only", async ({
    electronApp,
    mainWindow,
  }) => {
    const tempFolder = createTestImageFolder(3);
    try {
      await addLibraryAndScan(electronApp, mainWindow, tempFolder);

      const resolvedPath = await electronImagePath(mainWindow, tempFolder, "test-photo-2.jpg");
      await waitForCatalogItem(mainWindow, resolvedPath);
      await disableWriteEmbeddedMetadata(mainWindow);

      const result = await mainWindow.evaluate(async (p) => {
        return window.desktopApi.setMediaItemStarRating({ sourcePath: p, starRating: 5 });
      }, resolvedPath);

      expect(result.success).toBe(true);
      expect(result.metadata?.starRating).toBe(5);
    } finally {
      removeTestImageFolder(tempFolder);
    }
  });

  test("setMediaItemStarRating with embedded file metadata enabled updates catalog", async ({
    electronApp,
    mainWindow,
  }) => {
    const tempFolder = createTestImageFolder(3);
    try {
      await addLibraryAndScan(electronApp, mainWindow, tempFolder);

      const imgPath = await electronImagePath(mainWindow, tempFolder, "test-photo-1.jpg");
      await waitForCatalogItem(mainWindow, imgPath);
      const mtimeBeforeEmbeddedWrites = getFileMtimeMs(imgPath);
      await enableWriteEmbeddedMetadata(mainWindow);

      const result = await mainWindow.evaluate(async (p) => {
        return window.desktopApi.setMediaItemStarRating({ sourcePath: p, starRating: 4 });
      }, imgPath);

      expect(result.success).toBe(true);
      expect(result.metadata?.starRating).toBe(4);

      const starFromDbRoundTrip = await mainWindow.evaluate(async (p) => {
        const m = await window.desktopApi.getMediaItemsByPaths([p]);
        return m[p]?.starRating ?? null;
      }, imgPath);
      expect(starFromDbRoundTrip).toBe(4);

      await waitUntilFileShowsStarRatingAndNewerMtime(imgPath, 4, mtimeBeforeEmbeddedWrites);

      const mtimeAfterFourStars = getFileMtimeMs(imgPath);

      const resultSecond = await mainWindow.evaluate(async (p) => {
        return window.desktopApi.setMediaItemStarRating({ sourcePath: p, starRating: 2 });
      }, imgPath);
      expect(resultSecond.success).toBe(true);
      expect(resultSecond.metadata?.starRating).toBe(2);

      await waitUntilFileShowsStarRatingAndNewerMtime(imgPath, 2, mtimeAfterFourStars);
    } finally {
      removeTestImageFolder(tempFolder);
    }
  });

  test("embedded write uses Windows Explorer IFD0 Rating and RatingPercent (1,25,50,75,99)", async ({
    electronApp,
    mainWindow,
  }) => {
    const tempFolder = createTestImageFolder(1);
    try {
      await addLibraryAndScan(electronApp, mainWindow, tempFolder);

      const imgPath = await electronImagePath(mainWindow, tempFolder, "test-photo-1.jpg");
      await waitForCatalogItem(mainWindow, imgPath);
      await enableWriteEmbeddedMetadata(mainWindow);

      let mtimeBaseline = getFileMtimeMs(imgPath);

      const steps: Array<{ stars: number; ifd0Rating: number; percent: number }> = [
        { stars: 1, ifd0Rating: 1, percent: 1 },
        { stars: 2, ifd0Rating: 2, percent: 25 },
        { stars: 3, ifd0Rating: 3, percent: 50 },
        { stars: 4, ifd0Rating: 4, percent: 75 },
        { stars: 5, ifd0Rating: 5, percent: 99 },
      ];

      for (const step of steps) {
        const result = await mainWindow.evaluate(
          async ({ path: p, stars }) => {
            return window.desktopApi.setMediaItemStarRating({ sourcePath: p, starRating: stars });
          },
          { path: imgPath, stars: step.stars },
        );
        expect(result.success).toBe(true);

        await waitUntilFileShowsStarRatingAndNewerMtime(imgPath, step.stars, mtimeBaseline);

        const w = await readWindowsExifRatingTags(imgPath);
        expect(w.exifRating, `IFD0 Rating for ${step.stars} app stars`).toBe(step.ifd0Rating);
        expect(w.ratingPercent, `RatingPercent for ${step.stars} app stars`).toBe(step.percent);

        mtimeBaseline = getFileMtimeMs(imgPath);
      }
    } finally {
      removeTestImageFolder(tempFolder);
    }
  });

  test("grid hover and star click updates rating when embedded write is enabled", async ({
    electronApp,
    mainWindow,
  }) => {
    const uiFolder = createTestImageFolder(1);
    try {
      await addLibraryAndScan(electronApp, mainWindow, uiFolder);

      const imgPath = await electronImagePath(mainWindow, uiFolder, "test-photo-1.jpg");
      await waitForCatalogItem(mainWindow, imgPath);
      await enableWriteEmbeddedMetadata(mainWindow);

      const mtimeBeforeThreeStars = getFileMtimeMs(imgPath);
      await mainWindow.evaluate(async (p) => {
        await window.desktopApi.setMediaItemStarRating({ sourcePath: p, starRating: 3 });
      }, imgPath);
      await waitUntilFileShowsStarRatingAndNewerMtime(imgPath, 3, mtimeBeforeThreeStars);

      const mtimeBeforeClickFiveStars = getFileMtimeMs(imgPath);

      const grid = mainWindow.getByTestId("desktop-folder-thumbnails-grid");
      await expect(grid).toBeVisible({ timeout: 30_000 });

      const catalogBannerDismiss = mainWindow.getByRole("button", { name: "Dismiss" }).first();
      if (await catalogBannerDismiss.isVisible().catch(() => false)) {
        await catalogBannerDismiss.click();
      }

      const thumb = grid.locator("img[alt]").first();
      await expect(thumb).toBeVisible();
      // The grid card stacks a full-bleed hover overlay above the <img>; hover the card
      // (image wrap → card) so Playwright does not hit an "intercepted" target on the img.
      const card = thumb.locator("xpath=../..");
      await card.hover({ position: { x: 56, y: 36 } });

      const group = mainWindow.getByRole("radiogroup", { name: "Star rating" });
      await expect(group).toBeVisible({ timeout: 5_000 });
      await group.getByRole("radio", { name: "5 stars" }).click();

      await expect
        .poll(
          async () =>
            mainWindow.evaluate(async (p) => {
              const m = await window.desktopApi.getMediaItemsByPaths([p]);
              return m[p]?.starRating ?? null;
            }, imgPath),
          { timeout: 30_000 },
        )
        .toBe(5);

      await waitUntilFileShowsStarRatingAndNewerMtime(imgPath, 5, mtimeBeforeClickFiveStars);
    } finally {
      removeTestImageFolder(uiFolder);
    }
  });

  test.afterAll(async () => {
    await shutdownExiftoolForE2E();
  });
});
