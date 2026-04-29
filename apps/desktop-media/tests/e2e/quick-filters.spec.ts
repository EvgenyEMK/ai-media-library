import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { waitForSemanticSearchAiReady } from "./fixtures/e2e-ai-ready";
import { waitForSemanticIndexIdle } from "./fixtures/semantic-index-wait";

const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const REQUIRED_FILTER_FILES = [
  "mock_invoice_01_gemini.png",
  "receipt-mock-02-french.jpg",
  "Dutch_identity_card_front_specimen_issued_9_March_2014.jpg",
  "20191013_142053.jpg",
  "20200910_151932.jpg",
  "20200821_101037.jpg",
] as const;

function hasRequiredAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) {
    return false;
  }
  return REQUIRED_FILTER_FILES.every((name) => fs.existsSync(path.join(e2ePhotosDir, name)));
}

async function waitForPhotoAnalysisIdle(mainWindow: import("@playwright/test").Page, folderPath: string): Promise<void> {
  await mainWindow.waitForFunction(
    async (fp: string) => {
      const statuses = await window.desktopApi.getFolderAnalysisStatuses();
      const s = statuses[fp];
      return s != null && s.state !== "in_progress" && Boolean(s.photoAnalyzedAt);
    },
    folderPath,
    { timeout: 300_000 },
  );
}

async function openQuickFiltersMenu(mainWindow: import("@playwright/test").Page): Promise<void> {
  const menu = mainWindow.getByTestId("desktop-quick-filters-menu");
  if (await menu.isVisible().catch(() => false)) {
    return;
  }
  await mainWindow.getByTestId("desktop-quick-filters-trigger").click();
  await expect(menu).toBeVisible();
}

async function pickCustomSelectOption(
  mainWindow: import("@playwright/test").Page,
  selectTestId: string,
  optionName: string | RegExp,
): Promise<void> {
  await mainWindow.getByTestId(selectTestId).click();
  await mainWindow.getByRole("option", { name: optionName }).click();
}

test.use({
  ollamaMock: { e2eFilenameBasedAnalysis: true },
  e2eFilenameInAnalysisPrompt: true,
});

test.describe("Quick filters (e2e-photos)", () => {
  test.setTimeout(600_000);

  test("People and Documents filters narrow folder thumbnails", async ({ electronApp, mainWindow }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing quick-filter test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    await mainWindow.getByRole("button", { name: "More actions" }).click();
    await mainWindow.getByTitle("Start image AI analysis").click();
    await waitForPhotoAnalysisIdle(mainWindow, e2ePhotosDir);

    await openQuickFiltersMenu(mainWindow);
    await mainWindow.getByTestId("quick-filter-documents-checkbox").click();
    await pickCustomSelectOption(mainWindow, "quick-filter-documents-select", /Invoices \/ receipts/);
    await expect(mainWindow.getByAltText("mock_invoice_01_gemini.png")).toBeVisible({ timeout: 30_000 });
    await expect(mainWindow.getByAltText("receipt-mock-02-french.jpg")).toBeVisible();
    await expect(mainWindow.getByAltText("20191013_142053.jpg")).not.toBeVisible();

    await openQuickFiltersMenu(mainWindow);
    await mainWindow.getByTestId("quick-filter-clear-all").click();

    await mainWindow.getByTestId("quick-filter-documents-checkbox").click();
    await pickCustomSelectOption(mainWindow, "quick-filter-documents-select", /^IDs$/);
    await expect(mainWindow.getByAltText("Dutch_identity_card_front_specimen_issued_9_March_2014.jpg")).toBeVisible();
    await expect(mainWindow.getByAltText("mock_invoice_01_gemini.png")).not.toBeVisible();

    await openQuickFiltersMenu(mainWindow);
    await mainWindow.getByTestId("quick-filter-clear-all").click();

    await mainWindow.getByTestId("quick-filter-people-checkbox").click();
    await pickCustomSelectOption(mainWindow, "quick-filter-people-select", /^≥ 1$/);
    await expect(mainWindow.getByAltText("20191013_142053.jpg")).toBeVisible();
    await expect(mainWindow.getByAltText("mock_invoice_01_gemini.png")).not.toBeVisible();
  });

  test("AI Rating filter narrows folder thumbnails by AI esthetic score", async ({ electronApp, mainWindow }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing quick-filter test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    await mainWindow.getByRole("button", { name: "More actions" }).click();
    await mainWindow.getByTitle("Start image AI analysis").click();
    await waitForPhotoAnalysisIdle(mainWindow, e2ePhotosDir);

    await openQuickFiltersMenu(mainWindow);
    await mainWindow.getByTestId("quick-filter-ai-rating-checkbox").click();
    await pickCustomSelectOption(mainWindow, "quick-filter-ai-rating-select", /^≥ 4$/);

    await expect(mainWindow.getByTestId("desktop-folder-thumbnails-grid")).toBeVisible();
    await expect(mainWindow.getByAltText("20200910_151932.jpg")).toBeVisible();
    await expect(mainWindow.getByAltText("20200821_101037.jpg")).toBeVisible();
    await expect(mainWindow.getByAltText("20191013_142053.jpg")).not.toBeVisible();
    await expect(mainWindow.getByAltText("mock_invoice_01_gemini.png")).not.toBeVisible();
  });

  test("Categories filter uses checkbox + select (sports and nature)", async ({ electronApp, mainWindow }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing quick-filter test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    await mainWindow.getByRole("button", { name: "More actions" }).click();
    await mainWindow.getByTitle("Start image AI analysis").click();
    await waitForPhotoAnalysisIdle(mainWindow, e2ePhotosDir);

    await openQuickFiltersMenu(mainWindow);
    await mainWindow.getByTestId("quick-filter-categories-checkbox").click();
    await pickCustomSelectOption(mainWindow, "quick-filter-categories-select", /^Sports$/);
    await expect(mainWindow.getByAltText("20200910_151932.jpg")).not.toBeVisible();

    await openQuickFiltersMenu(mainWindow);
    await mainWindow.getByTestId("quick-filter-clear-all").click();

    await mainWindow.getByTestId("quick-filter-categories-checkbox").click();
    await pickCustomSelectOption(mainWindow, "quick-filter-categories-select", /^Nature$/);
    await expect(mainWindow.getByAltText("20200910_151932.jpg")).toBeVisible();
    await expect(mainWindow.getByAltText("20200821_101037.jpg")).toBeVisible();
    await expect(mainWindow.getByAltText("20191013_142053.jpg")).not.toBeVisible();
  });

  test("quick filters apply to AI search results and clear when returning to folder view", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing quick-filter test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await waitForSemanticSearchAiReady(mainWindow);

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    await mainWindow.getByRole("button", { name: "More actions" }).click();
    await mainWindow.getByTitle("Start image AI analysis").click();
    await waitForPhotoAnalysisIdle(mainWindow, e2ePhotosDir);

    await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "all",
        recursive: false,
      });
    }, e2ePhotosDir);
    await waitForSemanticIndexIdle(mainWindow);

    await mainWindow.locator(`button[title="Open AI image search"]`).click();
    await mainWindow.waitForTimeout(500);
    const searchInput = mainWindow.locator('input[placeholder*="Lady in white dress near piano"]');
    await searchInput.fill("Mountains with cloudy sky");
    await searchInput.press("Enter");

    const statusSpan = mainWindow.locator(".analysis-header-actions span");
    await expect(statusSpan).toContainText("result", { timeout: 60_000 });
    const searchGrid = mainWindow.getByTestId("desktop-search-results-grid");
    await expect(searchGrid).toBeVisible();
    const beforeFilter = await searchGrid.locator("img").count();
    expect(beforeFilter).toBeGreaterThan(0);

    await openQuickFiltersMenu(mainWindow);
    await mainWindow.getByTestId("quick-filter-categories-checkbox").click();
    await pickCustomSelectOption(mainWindow, "quick-filter-categories-select", /^Nature$/);

    await expect(searchGrid.getByAltText("20200910_151932.jpg")).toBeVisible({ timeout: 30_000 });
    await expect(searchGrid.getByAltText("20191013_142053.jpg")).not.toBeVisible();

    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(1_500);

    await expect(mainWindow.getByTestId("desktop-search-results-grid")).not.toBeVisible();
    await openQuickFiltersMenu(mainWindow);
    await expect(mainWindow.getByTestId("quick-filter-categories-checkbox")).not.toBeChecked();
  });
});
