import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot, mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import {
  createMoveChurnFixture,
  E2E_JPEG_VARIANTS_BASE64,
  removeMoveChurnFixture,
  type MoveChurnFixture,
} from "./fixtures/test-images";
import type { MetadataScanProgressEvent } from "../../src/shared/ipc";
import { UI_TEXT } from "../../src/renderer/lib/ui-text";

type MetadataJobCompleted = Extract<MetadataScanProgressEvent, { type: "job-completed" }>;

/** Two JPEGs under `<root>/media` so the library root has no direct images (avoids auto-scan filling the catalog before the manual scan). */
function createNestedTwoFileLibrary(): { root: string; mediaDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "emk-churn-flat-"));
  const mediaDir = path.join(root, "media");
  fs.mkdirSync(mediaDir);
  if (E2E_JPEG_VARIANTS_BASE64.length < 2) {
    throw new Error("createNestedTwoFileLibrary: need at least 2 JPEG variants");
  }
  fs.writeFileSync(path.join(mediaDir, "a.jpg"), Buffer.from(E2E_JPEG_VARIANTS_BASE64[0]!, "base64"));
  fs.writeFileSync(path.join(mediaDir, "b.jpg"), Buffer.from(E2E_JPEG_VARIANTS_BASE64[1]!, "base64"));
  return { root, mediaDir };
}

function removeDir(root: string): void {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

let moveFixture: MoveChurnFixture;
let deleteFixture: { root: string; mediaDir: string };

test.beforeAll(() => {
  moveFixture = createMoveChurnFixture();
  deleteFixture = createNestedTwoFileLibrary();
});

test.afterAll(() => {
  removeMoveChurnFixture(moveFixture);
  removeDir(deleteFixture.root);
});

async function addLibraryAndSelectRoot(
  electronApp: import("@playwright/test").ElectronApplication,
  mainWindow: Page,
  root: string,
): Promise<void> {
  await mockFolderDialog(electronApp, root);
  await mainWindow.getByText("Add library folder").click();
  await clickSidebarLibraryRoot(mainWindow, root);
  await mainWindow.waitForTimeout(1_500);
}

function awaitNextManualMetadataScanForFolder(
  mainWindow: Page,
  folderPath: string,
): Promise<MetadataJobCompleted> {
  return mainWindow.evaluate((fp) => {
    return new Promise<MetadataJobCompleted>((resolve, reject) => {
      let targetJobId: string | null = null;
      const timer = window.setTimeout(() => {
        unsub();
        reject(new Error("Timed out waiting for manual metadata scan job-completed"));
      }, 180_000);
      const unsub = window.desktopApi.onMetadataScanProgress((event) => {
        if (event.type === "job-started" && event.triggerSource === "manual" && event.folderPath === fp) {
          targetJobId = event.jobId;
          return;
        }
        if (event.type === "job-completed" && targetJobId !== null && event.jobId === targetJobId) {
          window.clearTimeout(timer);
          unsub();
          resolve(event);
        }
      });
    });
  }, folderPath);
}

async function runRecursiveMetadataScan(
  mainWindow: Page,
  libraryRoot: string,
): Promise<MetadataJobCompleted> {
  const normalized = path.normalize(libraryRoot);
  const completion = awaitNextManualMetadataScanForFolder(mainWindow, normalized);
  const sidebar = mainDesktopSidebar(mainWindow);
  const rootRow = sidebar.getByRole("button", { name: normalized, exact: true });
  /** Row container: `SidebarTree` wraps the folder label button in `div.group.relative`. */
  const row = rootRow.locator("..").locator("..");
  await row.hover();
  await row.getByRole("button", { name: "More", exact: true }).click();
  await mainWindow.getByRole("button", { name: UI_TEXT.scanForFileChanges }).click();
  const subfolders = mainWindow.getByRole("checkbox", { name: /Include sub-folders/i });
  await expect(subfolders).toBeVisible({ timeout: 10_000 });
  await subfolders.check();
  await mainWindow.locator('[title="Start metadata scan"]').first().click();
  return completion;
}

test.describe("Metadata scan — file churn (move / delete / duplicate / rename)", () => {
  test("cross-folder move does not report catalog row as missing on disk", async ({
    electronApp,
    mainWindow,
  }) => {
    await addLibraryAndSelectRoot(electronApp, mainWindow, moveFixture.root);

    await runRecursiveMetadataScan(mainWindow, moveFixture.root);

    fs.renameSync(moveFixture.fileToMove, moveFixture.fileToMoveDest);

    const afterMove = await runRecursiveMetadataScan(mainWindow, moveFixture.root);
    expect(afterMove.filesDeleted).toHaveLength(0);
  });

  test("deleting a file is reported as missing on disk", async ({ electronApp, mainWindow }) => {
    await addLibraryAndSelectRoot(electronApp, mainWindow, deleteFixture.root);

    await runRecursiveMetadataScan(mainWindow, deleteFixture.root);

    const toDelete = path.join(deleteFixture.mediaDir, "a.jpg");
    fs.unlinkSync(toDelete);

    const afterDelete = await runRecursiveMetadataScan(mainWindow, deleteFixture.root);
    expect(afterDelete.filesDeleted.length).toBeGreaterThanOrEqual(1);
  });

  test("same-folder duplicate and rename appear without missing-on-disk regression", async ({
    electronApp,
    mainWindow,
  }) => {
    const dupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-churn-dup-"));
    const dupMedia = path.join(dupRoot, "media");
    fs.mkdirSync(dupMedia);
    fs.writeFileSync(
      path.join(dupMedia, "solo.jpg"),
      Buffer.from(E2E_JPEG_VARIANTS_BASE64[0]!, "base64"),
    );
    try {
      await addLibraryAndSelectRoot(electronApp, mainWindow, dupRoot);

      await runRecursiveMetadataScan(mainWindow, dupRoot);

      const original = path.join(dupMedia, "solo.jpg");
      const duplicate = path.join(dupMedia, "solo-copy.jpg");
      fs.copyFileSync(original, duplicate);

      const afterDup = await runRecursiveMetadataScan(mainWindow, dupRoot);
      expect(afterDup.filesDeleted).toHaveLength(0);

      const renamed = path.join(dupMedia, "renamed-photo.jpg");
      fs.renameSync(duplicate, renamed);

      const afterRename = await runRecursiveMetadataScan(mainWindow, dupRoot);
      expect(afterRename.filesDeleted).toHaveLength(0);
    } finally {
      removeDir(dupRoot);
    }
  });
});
