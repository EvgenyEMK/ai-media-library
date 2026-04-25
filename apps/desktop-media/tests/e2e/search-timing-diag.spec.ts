/**
 * E2E test — measures the full timing pipeline for semantic search:
 *   1. Search button clicked (renderer)
 *   2. IPC call sent to main process
 *   3. Main process search completes
 *   4. IPC response arrives in renderer
 *   5. store.setState done
 *   6. React renders results in DOM
 *   7. Browser paint frame
 *
 * Runs on the small test-assets folder (with indexing) and optionally
 * on the user's large folder to reproduce real-world conditions.
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { waitForSemanticSearchAiReady } from "./fixtures/e2e-ai-ready";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { waitForSemanticIndexIdle } from "./fixtures/semantic-index-wait";

const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0
    ? configuredAssetsDir
    : defaultAssetsDir;

const REQUIRED_FILES = [
  "20200910_151932.jpg",
  "20191013_142053.jpg",
  "20230810_141737.jpg",
] as const;

function hasRequiredAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return REQUIRED_FILES.every((name) => fs.existsSync(path.join(e2ePhotosDir, name)));
}

interface TimingEntry {
  ts: number;
  msg: string;
}

test.describe("Search UI timing measurement", () => {
  test.setTimeout(600_000);

  test("measure end-to-end timing from search click to DOM render", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(!hasRequiredAssets(), `Missing test assets in: ${e2ePhotosDir}`);

    // Collect all main-process logs (includes routed renderer logs)
    const allLogs: TimingEntry[] = [];
    const logT0 = Date.now();
    const proc = electronApp.process();
    proc.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        allLogs.push({ ts: Date.now() - logT0, msg: line.trim() });
        if (line.includes("[semantic-search]") || line.includes("[metadata-scan]")) {
          console.log(`[electron][+${Date.now() - logT0}ms]`, line.trim());
        }
      }
    });
    proc.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        if (line.includes("[semantic-search]")) {
          console.log(`[electron:err]`, line.trim());
        }
      }
    });

    await waitForSemanticSearchAiReady(mainWindow);
    const capability = await mainWindow.evaluate(async () => {
      return window.desktopApi.getSemanticEmbeddingStatus();
    });
    console.log("[test] capability:", JSON.stringify(capability));

    // Set up library folder
    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    // Index all images (override mode to ensure fresh embeddings)
    console.log("[test] Indexing images...");
    const indexResult = await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "all",
        recursive: false,
      });
    }, e2ePhotosDir);
    expect(indexResult.total).toBeGreaterThan(0);
    await waitForSemanticIndexIdle(mainWindow);
    console.log(`[test] Indexed job ${indexResult.jobId} (${indexResult.total} items scheduled)`);

    // Open the semantic search panel via toolbar
    await mainWindow.locator('button[title="Open AI image search"]').click();
    await mainWindow.waitForTimeout(500);

    // Fill query and search via UI interaction (not evaluate)
    const searchInput = mainWindow.locator('input[placeholder*="Lady in white dress near piano"]');
    await searchInput.fill("Mountains with cloudy sky");

    // Clear any logs from before the search
    const preSearchLogCount = allLogs.length;
    const clickTime = Date.now();

    // Click the Search button
    const searchButton = mainWindow.getByRole("button", { name: "Search", exact: true });
    await searchButton.click();
    console.log(`\n[test] Search button clicked at +${clickTime - logT0}ms`);

    // Wait for result images to appear in the DOM
    const resultImages = mainWindow.locator('[data-testid="desktop-search-results-grid"] img');
    await expect(resultImages.first()).toBeVisible({ timeout: 30_000 });
    const domVisibleTime = Date.now();
    console.log(`[test] First result image visible at +${domVisibleTime - logT0}ms`);

    // Wait a frame for all images
    await mainWindow.waitForTimeout(200);
    const imageCount = await resultImages.count();
    console.log(`[test] Total result images: ${imageCount}`);

    // Collect the semantic-search timing logs that appeared after our click
    const searchLogs = allLogs
      .slice(preSearchLogCount)
      .filter((e) => e.msg.includes("[semantic-search]"));

    console.log("\n=== Semantic search timing logs ===");
    for (const entry of searchLogs) {
      console.log(`  [+${entry.ts}ms] ${entry.msg}`);
    }

    // Parse timing milestones from logs
    const findLog = (pattern: string) =>
      searchLogs.find((e) => e.msg.includes(pattern));

    const buttonClicked = findLog("search button clicked");
    const ipcResponse = findLog("IPC response received");
    const stateSetDone = findLog("store.setState done");
    const reactRendered = findLog("React rendered");
    const paintFrame = findLog("browser paint frame");

    console.log("\n=== Timing milestones (wall-clock from test start) ===");
    if (buttonClicked) console.log(`  Button clicked:    +${buttonClicked.ts}ms`);
    if (ipcResponse)   console.log(`  IPC response:      +${ipcResponse.ts}ms`);
    if (stateSetDone)  console.log(`  setState done:     +${stateSetDone.ts}ms`);
    if (reactRendered) console.log(`  React rendered:    +${reactRendered.ts}ms`);
    if (paintFrame)    console.log(`  Paint frame:       +${paintFrame.ts}ms`);
    console.log(`  DOM visible (PW):  +${domVisibleTime - logT0}ms`);

    // Compute deltas
    if (buttonClicked && ipcResponse) {
      const ipcTime = ipcResponse.ts - buttonClicked.ts;
      console.log(`\n  IPC round-trip:        ${ipcTime}ms (button → IPC response)`);
    }
    if (ipcResponse && reactRendered) {
      const renderDelay = reactRendered.ts - ipcResponse.ts;
      console.log(`  React render delay:    ${renderDelay}ms (IPC response → React commit)`);
    }
    if (ipcResponse && paintFrame) {
      const paintDelay = paintFrame.ts - ipcResponse.ts;
      console.log(`  Paint delay:           ${paintDelay}ms (IPC response → paint frame)`);
    }
    if (buttonClicked) {
      const totalPw = domVisibleTime - logT0 - buttonClicked.ts;
      console.log(`  Total (Playwright):    ${totalPw}ms (button → DOM visible)`);
    }

    // Assertions
    expect(imageCount).toBeGreaterThan(0);
    if (buttonClicked) {
      const totalTime = domVisibleTime - logT0 - buttonClicked.ts;
      console.log(`\n=== VERDICT: total button→DOM = ${totalTime}ms (target: <5000ms) ===`);
      expect(totalTime).toBeLessThan(5_000);
    }
  });
});
