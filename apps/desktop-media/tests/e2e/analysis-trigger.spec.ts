import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot, mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

let testFolder: string;

test.beforeAll(() => {
  testFolder = createTestImageFolder(3);
});

test.afterAll(() => {
  removeTestImageFolder(testFolder);
});

async function addAndSelectFolder(
  electronApp: import("@playwright/test").ElectronApplication,
  mainWindow: import("@playwright/test").Page,
  folder: string,
): Promise<void> {
  await mockFolderDialog(electronApp, folder);
  await mainWindow.getByText("Add library folder").click();
  await clickSidebarLibraryRoot(mainWindow, folder);
  await mainWindow.waitForTimeout(2_000);
}

test.describe("Photo analysis trigger", () => {
  test("actions menu shows analysis option when folder is selected", async ({
    electronApp,
    mainWindow,
  }) => {
    await addAndSelectFolder(electronApp, mainWindow, testFolder);

    const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
    await actionsButton.click();

    await expect(mainWindow.getByText("Image AI analysis")).toBeVisible();
  });

  test("clicking analyze does not crash the app", async ({
    electronApp,
    mainWindow,
  }) => {
    await addAndSelectFolder(electronApp, mainWindow, testFolder);

    const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
    await actionsButton.click();
    await mainWindow.getByText("Image AI analysis").click();

    // Wait for the action to process, then verify the app is still responsive
    await mainWindow.waitForTimeout(3_000);
    // Sidebar should still be visible — app did not crash
    await expect(mainDesktopSidebar(mainWindow)).toBeVisible();
  });
});

test.describe("Face detection trigger", () => {
  test("actions menu shows face detection option", async ({
    electronApp,
    mainWindow,
  }) => {
    await addAndSelectFolder(electronApp, mainWindow, testFolder);

    const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
    await actionsButton.click();

    await expect(
      mainWindow.locator(".desktop-actions-menu").getByRole("button", { name: "Face detection", exact: true }),
    ).toBeVisible();
  });

  test("clicking face detection does not crash the app", async ({
    electronApp,
    mainWindow,
  }) => {
    await addAndSelectFolder(electronApp, mainWindow, testFolder);

    const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
    await actionsButton.click();
    await mainWindow
      .locator(".desktop-actions-menu")
      .getByRole("button", { name: "Face detection", exact: true })
      .click();

    await mainWindow.waitForTimeout(3_000);
    await expect(mainDesktopSidebar(mainWindow)).toBeVisible();
  });
});
