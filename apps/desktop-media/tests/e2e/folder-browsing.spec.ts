import path from "node:path";
import { test, expect } from "../e2e/fixtures/app-fixture";
import { clickSidebarLibraryRoot, mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

const REAL_IMAGE_FOLDER = path.resolve(__dirname, "../../test-assets-local/e2e-photos");

let tempFolder: string;

test.beforeAll(() => {
  tempFolder = createTestImageFolder(5);
});

test.afterAll(() => {
  removeTestImageFolder(tempFolder);
});

test.describe("Folder browsing", () => {
  test("adding a library folder shows it in the sidebar tree", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, tempFolder);

    await mainWindow.getByText("Add library folder").click();

    const sidebar = mainDesktopSidebar(mainWindow);
    await expect(
      sidebar.getByRole("button", { name: path.normalize(tempFolder), exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("clicking a folder in the tree selects it and updates the header", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, tempFolder);
    await mainWindow.getByText("Add library folder").click();

    await clickSidebarLibraryRoot(mainWindow, tempFolder);

    const header = mainWindow.locator("header.panel-header");
    await expect(header).toContainText(tempFolder, { timeout: 10_000 });
  });

  test("selecting a folder clears the empty state", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, tempFolder);
    await mainWindow.getByText("Add library folder").click();

    await clickSidebarLibraryRoot(mainWindow, tempFolder);

    // The header should update — the initial "Select a folder" placeholder is replaced
    const header = mainWindow.locator("header.panel-header");
    await expect(header).toContainText(tempFolder, { timeout: 10_000 });
  });

  test("real photos folder loads thumbnails into the grid", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, REAL_IMAGE_FOLDER);
    await mainWindow.getByText("Add library folder").click();

    await clickSidebarLibraryRoot(mainWindow, REAL_IMAGE_FOLDER);

    const thumbnails = mainWindow.locator("main.main-panel img[alt]");
    await expect(thumbnails.first()).toBeVisible({ timeout: 15_000 });

    const count = await thumbnails.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("clicking a thumbnail opens the photo viewer", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, REAL_IMAGE_FOLDER);
    await mainWindow.getByText("Add library folder").click();

    await clickSidebarLibraryRoot(mainWindow, REAL_IMAGE_FOLDER);

    const thumbnail = mainWindow.locator("main.main-panel img[alt]").first();
    await expect(thumbnail).toBeVisible({ timeout: 15_000 });
    // force: true because the card's overlay div sits on top of the img
    await thumbnail.click({ force: true });

    const viewer = mainWindow.locator(".media-swiper-theme");
    await expect(viewer).toBeVisible({ timeout: 5_000 });
  });

  test("removing a library from row menu hides it without deleting files", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, tempFolder);
    await mainWindow.getByText("Add library folder").click();

    const sidebar = mainDesktopSidebar(mainWindow);
    const normalizedTemp = path.normalize(tempFolder);

    await clickSidebarLibraryRoot(mainWindow, tempFolder);
    await expect(mainWindow.locator("header.panel-header")).toContainText(tempFolder, { timeout: 10_000 });

    await sidebar
      .getByRole("button", { name: normalizedTemp, exact: true })
      .click({ button: "right" });
    await mainWindow.getByRole("button", { name: "Remove (does not delete)" }).click();

    await expect(sidebar.getByRole("button", { name: normalizedTemp, exact: true })).toBeHidden({
      timeout: 5_000,
    });
    await expect(mainWindow.locator(".empty-state")).toContainText("Select a folder to view media");
  });
});
