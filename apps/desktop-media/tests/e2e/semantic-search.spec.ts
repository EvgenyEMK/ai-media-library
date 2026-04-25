import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { waitForSemanticSearchAiReady } from "./fixtures/e2e-ai-ready";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { waitForSemanticIndexIdle } from "./fixtures/semantic-index-wait";

const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const e2ePhotosDir = configuredAssetsDir && configuredAssetsDir.length > 0
  ? configuredAssetsDir
  : defaultAssetsDir;

const REQUIRED_FILES = [
  "20200910_151932.jpg",
  "20191013_142053.jpg",
  "20230810_141737.jpg",
] as const;

interface PromptCase {
  prompt: string;
  expectedFilename: string;
  /** When true, only checks that the file appears somewhere in the results,
   *  not necessarily in the top 5. Useful for short/ambiguous queries. */
  softRanking?: boolean;
}

const PROMPT_CASES: PromptCase[] = [
  { prompt: "Mountains with cloudy sky", expectedFilename: "20200910_151932.jpg" },
  { prompt: "Boy with wakeboard in wakepark", expectedFilename: "20191013_142053.jpg" },
  { prompt: "wakepark", expectedFilename: "20191013_142053.jpg", softRanking: true },
  { prompt: "Selfie of bald man with woman in glasses", expectedFilename: "20230810_141737.jpg" },
];

function hasRequiredAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) {
    return false;
  }
  return REQUIRED_FILES.every((name) => fs.existsSync(path.join(e2ePhotosDir, name)));
}

test.describe("Semantic image search", () => {
  test.setTimeout(600_000);

  test("builds semantic index for e2e-photos with no failed items", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing semantic test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await waitForSemanticSearchAiReady(mainWindow);

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    const run = await mainWindow.evaluate(async (folderPath) => {
      const result = await window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "all",
        recursive: false,
      });

      const summary = await new Promise<{
        completed: number;
        failed: number;
        cancelled: number;
        failedPaths: string[];
      }>((resolve) => {
        const failedPaths: string[] = [];
        const unsubscribe = window.desktopApi.onSemanticIndexProgress((event) => {
          if (event.jobId !== result.jobId) return;
          if (event.type === "item-updated" && event.item.status === "failed") {
            failedPaths.push(event.item.path);
          }
          if (event.type === "job-completed") {
            unsubscribe();
            resolve({
              completed: event.completed,
              failed: event.failed,
              cancelled: event.cancelled,
              failedPaths,
            });
          }
        });
      });

      return { total: result.total, ...summary };
    }, e2ePhotosDir);

    await waitForSemanticIndexIdle(mainWindow);
    console.log("[test] semantic indexing batch result:", JSON.stringify(run));
    expect(run.total).toBeGreaterThan(0);
    expect(run.failedPaths).toEqual([]);
    expect(run.failed).toBe(0);
    expect(run.completed).toBe(run.total);
  });

  test("indexes images with override-existing and ranks expected photo in top results", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing semantic test assets. Expected files in: ${e2ePhotosDir}`,
    );

    // Capture Electron main process logs for diagnostics
    const proc = electronApp.process();
    proc.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        console.log("[electron]", line);
      }
    });
    proc.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        console.log("[electron:err]", line);
      }
    });

    const appUserData = await electronApp.evaluate(({ app }) => app.getPath("userData"));
    console.log("[test] app userData path:", appUserData);
    expect(appUserData).toContain("emk-e2e-userdata-");

    await waitForSemanticSearchAiReady(mainWindow);
    const capability = await mainWindow.evaluate(async () => {
      return window.desktopApi.getSemanticEmbeddingStatus();
    });
    console.log("[test] capability:", JSON.stringify(capability));
    console.log("[test] embedding method: direct ONNX vision");

    // Set up library folder
    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    // Step 1: initial index with mode "missing" (should create all embeddings)
    console.log("[test] Step 1: indexing with mode=missing");
    const initialResult = await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "missing",
        recursive: false,
      });
    }, e2ePhotosDir);
    console.log("[test] Initial indexing result:", JSON.stringify(initialResult));
    expect(initialResult.total).toBeGreaterThanOrEqual(REQUIRED_FILES.length);

    await waitForSemanticIndexIdle(mainWindow);

    // Step 2: re-index with mode "all" (override existing — should re-create all)
    console.log("[test] Step 2: re-indexing with mode=all (override existing)");
    const overrideResult = await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "all",
        recursive: false,
      });
    }, e2ePhotosDir);
    console.log("[test] Override indexing result:", JSON.stringify(overrideResult));
    expect(overrideResult.total).toBeGreaterThanOrEqual(REQUIRED_FILES.length);
    await waitForSemanticIndexIdle(mainWindow);
    console.log(`[test] Override indexing finished for job ${overrideResult.jobId} (total items ${overrideResult.total})`);

    // Verify embeddings produce score spread (not degenerate)
    const diagScores = await mainWindow.evaluate(async () => {
      const r = await window.desktopApi.semanticSearchPhotos({ query: "mountains", limit: 20 });
      return r.results.map((x: { score: number }) => x.score);
    });
    expect(diagScores.length).toBeGreaterThan(0);
    if (diagScores.length > 1) {
      const spread = diagScores[0] - diagScores[diagScores.length - 1];
      console.log("[test] score spread:", spread.toFixed(6));
      expect(spread).toBeGreaterThan(0.001);
    }

    // Search for each prompt via IPC and verify expected image is in results
    for (const testCase of PROMPT_CASES) {
      console.log(`[test] Searching: "${testCase.prompt}" — expecting: ${testCase.expectedFilename}`);

      const searchResults = await mainWindow.evaluate(
        async ({ prompt, limit }) => {
          const { results } = await window.desktopApi.semanticSearchPhotos({ query: prompt, limit });
          return results.map((r: { name: string; score: number }) => ({
            name: r.name,
            score: r.score,
          }));
        },
        { prompt: testCase.prompt, limit: 20 },
      );

      console.log(
        `[test] Results for "${testCase.prompt}" (${searchResults.length} total):`,
        searchResults.slice(0, 5).map((r: { name: string; score: number }) => `${r.name}=${r.score.toFixed(4)}`),
      );

      expect(searchResults.length).toBeGreaterThan(0);
      const resultNames = searchResults.map((r: { name: string }) => r.name);
      expect(resultNames).toContain(testCase.expectedFilename);

      if (!testCase.softRanking) {
        const top5Names = resultNames.slice(0, 5);
        expect(top5Names).toContain(testCase.expectedFilename);
      }
    }
  });

  test("search results appear in UI grid after typing a query", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing semantic test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await waitForSemanticSearchAiReady(mainWindow);

    // Set up library folder and index with override-existing
    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "all",
        recursive: false,
      });
    }, e2ePhotosDir);
    await waitForSemanticIndexIdle(mainWindow);

    // Open semantic search panel via toolbar button
    await mainWindow.locator(`button[title="Open AI image search"]`).click();
    await mainWindow.waitForTimeout(500);

    // Type a query and press Enter
    const searchInput = mainWindow.locator('input[placeholder*="Lady in white dress near piano"]');
    await searchInput.fill("Mountains with cloudy sky");
    await searchInput.press("Enter");

    // Wait for result status text (e.g. "Found 12 result(s).")
    const statusSpan = mainWindow.locator(".analysis-header-actions span");
    await expect(statusSpan).toContainText("result", { timeout: 30_000 });
    const statusText = await statusSpan.textContent();
    console.log(`[test][UI] Status text: ${statusText}`);

    // Verify result thumbnails are visible in the search results grid
    const resultImages = mainWindow.locator('[data-testid="desktop-search-results-grid"] img');
    const imageCount = await resultImages.count();
    console.log(`[test][UI] Result images visible: ${imageCount}`);
    expect(imageCount).toBeGreaterThan(0);
  });

  test("search icon active state follows results and folder click hides AI search panel", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing semantic test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await waitForSemanticSearchAiReady(mainWindow);

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "all",
        recursive: false,
      });
    }, e2ePhotosDir);
    await waitForSemanticIndexIdle(mainWindow);

    const semanticButton = mainWindow.locator('button[title="Open AI image search"]');
    await expect(semanticButton).toHaveAttribute("aria-pressed", "false");

    await semanticButton.click();
    const searchInput = mainWindow.locator('input[placeholder*="Lady in white dress near piano"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Mountains with cloudy sky");
    await searchInput.press("Enter");

    await expect(mainWindow.getByTestId("desktop-search-results-grid")).toBeVisible({ timeout: 60_000 });
    await expect(semanticButton).toHaveAttribute("aria-pressed", "true");

    await mainWindow.getByRole("button", { name: "Clear results" }).click();
    await expect(mainWindow.getByTestId("desktop-search-results-grid")).not.toBeVisible();
    await expect(semanticButton).toHaveAttribute("aria-pressed", "false");

    await expect(searchInput).toBeVisible();
    await searchInput.fill("Mountains with cloudy sky");
    await searchInput.press("Enter");
    await expect(mainWindow.getByTestId("desktop-search-results-grid")).toBeVisible({ timeout: 60_000 });

    // Re-selecting any folder should hide AI search panel and clear search results.
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);

    await expect(searchInput).not.toBeVisible();
    await expect(mainWindow.getByTestId("desktop-search-results-grid")).not.toBeVisible();
    await expect(semanticButton).toHaveAttribute("aria-pressed", "false");
  });

  test("shows two-line empty message when thresholds hide all search results", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(
      !hasRequiredAssets(),
      `Missing semantic test assets. Expected files in: ${e2ePhotosDir}`,
    );

    await waitForSemanticSearchAiReady(mainWindow);

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "all",
        recursive: false,
      });
    }, e2ePhotosDir);
    await waitForSemanticIndexIdle(mainWindow);

    const semanticButton = mainWindow.locator('button[title="Open AI image search"]');
    await semanticButton.click();

    const searchInput = mainWindow.locator('input[placeholder*="Lady in white dress near piano"]');
    await searchInput.fill("Mountains with cloudy sky");
    await searchInput.press("Enter");
    await expect(mainWindow.getByTestId("desktop-search-results-grid")).toBeVisible({ timeout: 60_000 });

    await mainWindow.getByRole("navigation").getByText("Settings", { exact: true }).click();
    const hideAdvancedSettingsCheckbox = mainWindow.getByRole("checkbox", {
      name: /Hide advanced settings/i,
    });
    if (await hideAdvancedSettingsCheckbox.isChecked()) {
      await hideAdvancedSettingsCheckbox.uncheck();
    }
    const aiSearchCard = mainWindow.locator("details").filter({
      has: mainWindow.getByText("AI image search", { exact: true }),
    });
    await aiSearchCard.locator("summary").click();
    const thresholdInputs = aiSearchCard.getByRole("spinbutton");
    await thresholdInputs.nth(0).fill("1");
    await thresholdInputs.nth(0).press("Enter");
    await thresholdInputs.nth(1).fill("1");
    await thresholdInputs.nth(1).press("Enter");

    await mainWindow.getByRole("navigation").getByText("Folders", { exact: true }).click();

    await expect(mainWindow.getByText("Nothing found", { exact: true })).toBeVisible();
    await expect(
      mainWindow.getByText(
        "All search results are below similarity threasholds defined in Settings → AI image search",
        { exact: true },
      ),
    ).toBeVisible();
  });
});
