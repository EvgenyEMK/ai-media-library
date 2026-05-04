import { expect, test } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

test.describe.configure({ mode: "serial", timeout: 300_000 });

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

async function waitForCatalogItem(mainWindow: import("@playwright/test").Page, filePath: string): Promise<void> {
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

test.describe("Album grid reorder", () => {
  test("grid reorder drop moves second item before first (catalog order)", async ({ electronApp, mainWindow }) => {
    const tempFolder = createTestImageFolder(2);
    const albumTitle = `E2E Reorder ${Date.now()}`;

    try {
      await addLibraryAndScan(electronApp, mainWindow, tempFolder);

      const path1 = await electronImagePath(mainWindow, tempFolder, "test-photo-1.jpg");
      const path2 = await electronImagePath(mainWindow, tempFolder, "test-photo-2.jpg");
      await waitForCatalogItem(mainWindow, path1);
      await waitForCatalogItem(mainWindow, path2);
      const id1 = await mainWindow.evaluate(async (p) => {
        const m = await window.desktopApi.getMediaItemsByPaths([p]);
        return m[p]!.id;
      }, path1);
      const id2 = await mainWindow.evaluate(async (p) => {
        const m = await window.desktopApi.getMediaItemsByPaths([p]);
        return m[p]!.id;
      }, path2);

      const albumId = await mainWindow.evaluate(
        async ({ title, mediaIds }) => {
          const album = await window.desktopApi.createAlbum(title);
          await window.desktopApi.addMediaItemsToAlbum(album.id, mediaIds);
          return album.id;
        },
        { title: albumTitle, mediaIds: [id1, id2] },
      );

      await mainWindow.getByRole("button", { name: "Albums" }).click();
      const mainPanel = mainWindow.locator("main.main-panel");
      await expect(mainPanel.getByRole("heading", { name: "Albums" })).toBeVisible();

      await mainPanel.getByRole("button", { name: albumTitle }).click();
      await expect(mainPanel.getByRole("heading", { name: albumTitle })).toBeVisible();

      await mainPanel.getByRole("button", { name: "Grid view" }).click();

      const cards = mainPanel.locator('[draggable="true"]');
      await expect(cards).toHaveCount(2);

      /**
       * Playwright `dragTo` does not reliably populate `dataTransfer` for this HTML5
       * reorder path in Electron. Dispatch a real `drop` with the same payload the grid
       * uses (`emk-grid-reorder:<fromIndex>`) so we still exercise the renderer → IPC chain.
       */
      await mainWindow.evaluate(() => {
        const main = document.querySelector("main.main-panel");
        if (!main) {
          throw new Error("main.main-panel not found");
        }
        const draggables = Array.from(main.querySelectorAll("[draggable='true']")) as HTMLElement[];
        if (draggables.length < 2) {
          throw new Error(`expected 2 draggable album cards, got ${draggables.length}`);
        }
        const dropSurface = draggables[0]!.parentElement;
        if (!dropSurface) {
          throw new Error("album card wrapper missing");
        }
        const rect = dropSurface.getBoundingClientRect();
        const x = rect.left + 4;
        const y = rect.top + rect.height / 2;
        const dt = new DataTransfer();
        dt.setData("text/plain", "emk-grid-reorder:1");
        const ev = new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: x,
          clientY: y,
        });
        dropSurface.dispatchEvent(ev);
      });

      await expect
        .poll(
          async () =>
            mainWindow.evaluate(
              async ({ aid }) => {
                const r = await window.desktopApi.listAlbumItems({ albumId: aid, limit: 10 });
                return r.rows.map((row) => row.id);
              },
              { aid: albumId },
            ),
          { timeout: 30_000 },
        )
        .toEqual([id2, id1]);
    } finally {
      removeTestImageFolder(tempFolder);
    }
  });
});
