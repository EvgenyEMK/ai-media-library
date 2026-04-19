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
import { UI_TEXT } from "../../src/renderer/lib/ui-text";

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

async function runRecursiveMetadataScan(mainWindow: Page, libraryRoot: string): Promise<void> {
  const normalized = path.normalize(libraryRoot);
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
}

async function waitForManualScanPanel(mainWindow: Page): Promise<void> {
  await expect(mainWindow.getByText(UI_TEXT.metadataManualScanResultTitle)).toBeVisible({
    timeout: 180_000,
  });
}

async function closeManualScanPanel(mainWindow: Page): Promise<void> {
  const closeBtn = mainWindow.getByRole("button", { name: UI_TEXT.metadataManualScanResultClose });
  await closeBtn.click();
  await expect(mainWindow.getByText(UI_TEXT.metadataManualScanResultTitle)).toBeHidden({
    timeout: 10_000,
  });
}

test.describe("Metadata scan — file churn (move / delete / duplicate / rename)", () => {
  test("cross-folder move does not report catalog row as missing on disk", async ({
    electronApp,
    mainWindow,
  }) => {
    await addLibraryAndSelectRoot(electronApp, mainWindow, moveFixture.root);

    await runRecursiveMetadataScan(mainWindow, moveFixture.root);
    await waitForManualScanPanel(mainWindow);
    await closeManualScanPanel(mainWindow);

    fs.renameSync(moveFixture.fileToMove, moveFixture.fileToMoveDest);

    await runRecursiveMetadataScan(mainWindow, moveFixture.root);
    await waitForManualScanPanel(mainWindow);

    await expect(
      mainWindow.getByText(UI_TEXT.metadataManualScanGroupDeleted, { exact: false }),
    ).toHaveCount(0);

    await closeManualScanPanel(mainWindow);
  });

  test("deleting a file is reported as missing on disk", async ({ electronApp, mainWindow }) => {
    await addLibraryAndSelectRoot(electronApp, mainWindow, deleteFixture.root);

    await runRecursiveMetadataScan(mainWindow, deleteFixture.root);
    await waitForManualScanPanel(mainWindow);
    await closeManualScanPanel(mainWindow);

    const toDelete = path.join(deleteFixture.mediaDir, "a.jpg");
    fs.unlinkSync(toDelete);

    await runRecursiveMetadataScan(mainWindow, deleteFixture.root);
    await waitForManualScanPanel(mainWindow);

    await expect(mainWindow.getByText(UI_TEXT.metadataManualScanGroupDeleted)).toBeVisible();

    await closeManualScanPanel(mainWindow);
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
      await waitForManualScanPanel(mainWindow);
      await closeManualScanPanel(mainWindow);

      const original = path.join(dupMedia, "solo.jpg");
      const duplicate = path.join(dupMedia, "solo-copy.jpg");
      fs.copyFileSync(original, duplicate);

      await runRecursiveMetadataScan(mainWindow, dupRoot);
      await waitForManualScanPanel(mainWindow);
      await expect(
        mainWindow.getByText(UI_TEXT.metadataManualScanGroupDeleted, { exact: false }),
      ).toHaveCount(0);
      await closeManualScanPanel(mainWindow);

      const renamed = path.join(dupMedia, "renamed-photo.jpg");
      fs.renameSync(duplicate, renamed);

      await runRecursiveMetadataScan(mainWindow, dupRoot);
      await waitForManualScanPanel(mainWindow);
      await expect(
        mainWindow.getByText(UI_TEXT.metadataManualScanGroupDeleted, { exact: false }),
      ).toHaveCount(0);
      await closeManualScanPanel(mainWindow);
    } finally {
      removeDir(dupRoot);
    }
  });
});
