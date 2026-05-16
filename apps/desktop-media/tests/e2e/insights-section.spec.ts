import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "../e2e/fixtures/app-fixture";
import { mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

const MAIN_PANEL = "main.main-panel";

let singleLibraryFolder: string;
let secondLibraryFolder: string;

test.beforeAll(() => {
  singleLibraryFolder = createTestImageFolder(2);
  secondLibraryFolder = createTestImageFolder(2);
});

test.afterAll(() => {
  removeTestImageFolder(singleLibraryFolder);
  removeTestImageFolder(secondLibraryFolder);
});

async function expandInsightsAndOpenDuplicateFiles(mainWindow: Page): Promise<void> {
  const sidebar = mainDesktopSidebar(mainWindow);
  await sidebar.getByRole("button", { name: "Insights", exact: true }).click();
  await sidebar.getByRole("button", { name: "Duplicate files" }).click();
}

async function expandInsightsAndOpenFolderAnalysis(mainWindow: Page): Promise<void> {
  const sidebar = mainDesktopSidebar(mainWindow);
  await sidebar.getByRole("button", { name: "Insights", exact: true }).click();
  await sidebar.getByRole("button", { name: "Folder analysis status" }).click();
}

async function expandInsightsAndOpenWronglyRotated(mainWindow: Page): Promise<void> {
  const sidebar = mainDesktopSidebar(mainWindow);
  await sidebar.getByRole("button", { name: "Insights", exact: true }).click();
  await sidebar.getByRole("button", { name: "Wrongly rotated images" }).click();
}

async function clickDuplicateFlowBack(mainWindow: Page): Promise<void> {
  const main = mainWindow.locator(MAIN_PANEL);
  await main
    .getByRole("button", { name: /^(Exit duplicates view|Back to duplicate folders)$/ })
    .click();
}

test.describe("Insights section", () => {
  test("Duplicate files: single library skips hub, Back returns to Duplicate files hub", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, singleLibraryFolder);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();
    await expect(
      mainDesktopSidebar(mainWindow).getByRole("button", {
        name: path.normalize(singleLibraryFolder),
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });

    await expandInsightsAndOpenDuplicateFiles(mainWindow);

    const main = mainWindow.locator(MAIN_PANEL);
    await expect(main.getByRole("heading", { name: /Duplicates in folder/ })).toBeVisible({ timeout: 30_000 });
    await expect(main.getByRole("heading", { level: 1, name: "Duplicate files", exact: true })).toBeHidden();
    await expect(main.getByText(path.normalize(singleLibraryFolder))).toBeVisible();

    await clickDuplicateFlowBack(mainWindow);

    await expect(main.getByRole("heading", { level: 1, name: "Duplicate files", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(main.getByText(path.normalize(singleLibraryFolder))).toBeVisible();
  });

  test("Duplicate files: two libraries shows hub, pick one, Back returns to hub with both roots", async ({
    electronApp,
    mainWindow,
  }) => {
    const normA = path.normalize(singleLibraryFolder);
    const normB = path.normalize(secondLibraryFolder);

    await mockFolderDialog(electronApp, singleLibraryFolder);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();
    await expect(mainDesktopSidebar(mainWindow).getByRole("button", { name: normA, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await mockFolderDialog(electronApp, secondLibraryFolder);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();
    await expect(mainDesktopSidebar(mainWindow).getByRole("button", { name: normB, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await expandInsightsAndOpenDuplicateFiles(mainWindow);

    const main = mainWindow.locator(MAIN_PANEL);
    await expect(main.getByRole("heading", { level: 1, name: "Duplicate files", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(main.getByText(normA)).toBeVisible();
    await expect(main.getByText(normB)).toBeVisible();

    await main.getByTitle(normB, { exact: true }).click();

    await expect(main.getByRole("heading", { name: /Duplicates in folder/ })).toBeVisible({ timeout: 30_000 });
    await expect(main.getByText(normB)).toBeVisible();

    await clickDuplicateFlowBack(mainWindow);

    await expect(main.getByRole("heading", { level: 1, name: "Duplicate files", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(main.getByText(normA)).toBeVisible();
    await expect(main.getByText(normB)).toBeVisible();
  });

  test("Folder analysis status: single library opens summary, Back to images returns to hub", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, singleLibraryFolder);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();
    await expect(
      mainDesktopSidebar(mainWindow).getByRole("button", {
        name: path.normalize(singleLibraryFolder),
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });

    await expandInsightsAndOpenFolderAnalysis(mainWindow);

    const main = mainWindow.locator(MAIN_PANEL);
    await expect(main.getByRole("button", { name: "Back to images", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(main.getByRole("heading", { level: 1, name: "Folder analysis status", exact: true })).toBeHidden();

    await main.getByRole("button", { name: "Back to images", exact: true }).click();

    await expect(main.getByRole("heading", { level: 1, name: "Folder analysis status", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(main.getByText(path.normalize(singleLibraryFolder))).toBeVisible();
  });

  test("Insights sub-nav lists folder analysis before wrongly rotated before duplicate files", async ({
    mainWindow,
  }) => {
    const sidebar = mainDesktopSidebar(mainWindow);
    await sidebar.getByRole("button", { name: "Insights", exact: true }).click();

    const subNavButtons = sidebar.locator("button").filter({
      hasText: /^(Folder analysis status|Wrongly rotated images|Duplicate files)$/,
    });
    await expect(subNavButtons).toHaveCount(3);
    await expect(subNavButtons.nth(0)).toHaveText("Folder analysis status");
    await expect(subNavButtons.nth(1)).toHaveText("Wrongly rotated images");
    await expect(subNavButtons.nth(2)).toHaveText("Duplicate files");
  });

  test("Wrongly rotated images: single library opens review list", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, singleLibraryFolder);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();
    await expect(
      mainDesktopSidebar(mainWindow).getByRole("button", {
        name: path.normalize(singleLibraryFolder),
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });

    await expandInsightsAndOpenWronglyRotated(mainWindow);

    const main = mainWindow.locator(MAIN_PANEL);
    await expect(main.getByRole("heading", { name: "Wrongly rotated images" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      main.getByRole("heading", { level: 1, name: "Wrongly rotated images", exact: true }),
    ).toBeHidden();
  });

  test("Wrongly rotated images: two libraries shows hub, pick one opens review", async ({
    electronApp,
    mainWindow,
  }) => {
    const normA = path.normalize(singleLibraryFolder);
    const normB = path.normalize(secondLibraryFolder);

    await mockFolderDialog(electronApp, singleLibraryFolder);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();
    await expect(mainDesktopSidebar(mainWindow).getByRole("button", { name: normA, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await mockFolderDialog(electronApp, secondLibraryFolder);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();
    await expect(mainDesktopSidebar(mainWindow).getByRole("button", { name: normB, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await expandInsightsAndOpenWronglyRotated(mainWindow);

    const main = mainWindow.locator(MAIN_PANEL);
    await expect(
      main.getByRole("heading", { level: 1, name: "Wrongly rotated images", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await main.getByTitle(normA, { exact: true }).click();

    await expect(main.getByRole("heading", { name: "Wrongly rotated images" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(main.getByText("Include subfolders")).toBeVisible();
  });

  test("Duplicate files from Insights with no libraries shows empty guidance", async ({ mainWindow }) => {
    const sidebar = mainDesktopSidebar(mainWindow);
    await sidebar.getByRole("button", { name: "Insights", exact: true }).click();
    await sidebar.getByRole("button", { name: "Duplicate files" }).click();

    await expect(
      mainWindow.locator(MAIN_PANEL).getByText("Please add folders first and run full scan"),
    ).toBeVisible();
  });
});
