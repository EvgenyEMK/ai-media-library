import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import {
  createTestImageFolder,
  removeTestImageFolder,
} from "./fixtures/test-images";

const REPLACEMENT_FIXTURE = path.resolve(
  __dirname,
  "../../test-assets-local/e2e-photos/IMG-20220802-WA0016.jpg",
);

test.describe.configure({ mode: "serial", timeout: 300_000 });

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

async function electronImagePath(
  mainWindow: import("@playwright/test").Page,
  folderPath: string,
  fileName: string,
): Promise<string> {
  const resolved = await mainWindow.evaluate(
    async ({ folder, name }) => {
      const images = await window.desktopApi.listFolderImages(folder);
      return images.find((img) => img.name === name)?.path ?? null;
    },
    { folder: folderPath, name: fileName },
  );
  expect(resolved, `Expected ${fileName} under ${folderPath}`).not.toBeNull();
  return resolved as string;
}

test.describe("Metadata scan — edited file keeps path but resets old metadata", () => {
  test("replaced same-name file refreshes catalog metadata after rescan", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(!fs.existsSync(REPLACEMENT_FIXTURE), "replacement fixture image not found");
    const folder = createTestImageFolder(1);
    try {
      await addLibraryAndScan(electronApp, mainWindow, folder);
      const imagePath = await electronImagePath(mainWindow, folder, "test-photo-1.jpg");
      const before = await mainWindow.evaluate(async (p) => {
        const m = await window.desktopApi.getMediaItemsByPaths([p]);
        return {
          width: m[p]?.width ?? null,
          height: m[p]?.height ?? null,
        };
      }, imagePath);
      expect(before.width).not.toBeNull();
      expect(before.height).not.toBeNull();

      fs.copyFileSync(REPLACEMENT_FIXTURE, imagePath);

      await mainWindow.evaluate(async (folderPath) => {
        await window.desktopApi.scanFolderMetadata({ folderPath, recursive: false });
      }, folder);

      await expect
        .poll(
          async () =>
            mainWindow.evaluate(async ({ p, beforeWidth, beforeHeight }) => {
              const m = await window.desktopApi.getMediaItemsByPaths([p]);
              const width = m[p]?.width ?? null;
              const height = m[p]?.height ?? null;
              return width !== beforeWidth || height !== beforeHeight;
            }, { p: imagePath, beforeWidth: before.width, beforeHeight: before.height }),
          { timeout: 90_000 },
        )
        .toBe(true);

      const after = await mainWindow.evaluate(async (p) => {
        const m = await window.desktopApi.getMediaItemsByPaths([p]);
        return {
          width: m[p]?.width ?? null,
          height: m[p]?.height ?? null,
        };
      }, imagePath);
      expect(after.width).not.toBe(before.width);
      expect(after.height).not.toBe(before.height);
    } finally {
      removeTestImageFolder(folder);
    }
  });
});
