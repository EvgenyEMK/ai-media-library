import fs from "node:fs";
import path from "node:path";
import type { ElectronApplication, Page } from "@playwright/test";
import { expect } from "./app-fixture";
import { clickSidebarLibraryRoot } from "./desktop-sidebar";
import { mockFolderDialog } from "./mock-dialog";

export const E2E_MEDIA_MIXED_DIR = path.resolve(
  __dirname,
  "../../../test-assets-local/e2e-media-mixed",
);

export function hasE2eMixedMediaAssets(): boolean {
  return fs.existsSync(E2E_MEDIA_MIXED_DIR);
}

export async function openE2eMixedMediaLibrary(
  electronApp: ElectronApplication,
  mainWindow: Page,
): Promise<void> {
  await mockFolderDialog(electronApp, E2E_MEDIA_MIXED_DIR);
  await mainWindow.getByText("Add library folder").click();
  await clickSidebarLibraryRoot(mainWindow, E2E_MEDIA_MIXED_DIR);
}

export async function readMixedMediaNames(mainWindow: Page): Promise<{
  imageNames: string[];
  videoNames: string[];
}> {
  const data = await mainWindow.evaluate(async (folderPath) => {
    const items = await window.desktopApi.listFolderMedia(folderPath);
    return {
      imageNames: items.filter((i) => i.mediaKind === "image").map((i) => i.name),
      videoNames: items.filter((i) => i.mediaKind === "video").map((i) => i.name),
    };
  }, E2E_MEDIA_MIXED_DIR);
  return data;
}

export async function switchToListView(mainWindow: Page): Promise<void> {
  await mainWindow.getByRole("button", { name: "List view" }).click();
  const firstRow = mainWindow.locator("article").first();
  await expect(firstRow).toBeVisible({ timeout: 10_000 });
}

export async function switchToGridView(mainWindow: Page): Promise<void> {
  await mainWindow.getByRole("button", { name: "Grid view" }).click();
  await expect(mainWindow.getByTestId("desktop-folder-thumbnails-grid")).toBeVisible({
    timeout: 10_000,
  });
}

export async function readFolderMediaOrder(mainWindow: Page): Promise<
  Array<{ name: string; kind: "image" | "video" | string }>
> {
  return mainWindow.evaluate(async (folderPath) => {
    const items = await window.desktopApi.listFolderMedia(folderPath);
    return items.map((i) => ({ name: i.name, kind: i.mediaKind }));
  }, E2E_MEDIA_MIXED_DIR);
}
