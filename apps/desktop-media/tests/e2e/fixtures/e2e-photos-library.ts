import path from "node:path";
import type { ElectronApplication, Page } from "@playwright/test";
import { expect } from "./app-fixture";
import { clickSidebarLibraryRoot } from "./desktop-sidebar";
import { mockFolderDialog } from "./mock-dialog";

/** Local JPEG library used by desktop E2E tests (not committed in some environments). */
export const E2E_PHOTOS_DIR = path.resolve(__dirname, "../../../test-assets-local/e2e-photos");

export async function openE2ePhotoLibrary(electronApp: ElectronApplication, mainWindow: Page): Promise<void> {
  await mockFolderDialog(electronApp, E2E_PHOTOS_DIR);
  await mainWindow.getByText("Add library folder").click();

  await clickSidebarLibraryRoot(mainWindow, E2E_PHOTOS_DIR);
}

export async function openFirstPhotoInViewer(mainWindow: Page): Promise<void> {
  const thumbnail = mainWindow.locator("main.main-panel img[alt]").first();
  await expect(thumbnail).toBeVisible({ timeout: 15_000 });
  await thumbnail.click({ force: true });

  const viewer = mainWindow.locator(".media-swiper-theme");
  await expect(viewer).toBeVisible({ timeout: 5_000 });
}
