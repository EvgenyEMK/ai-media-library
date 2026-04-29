import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { E2E_JPEG_VARIANTS_BASE64 } from "./fixtures/test-images";
import type { PipelineQueueSnapshot } from "../../src/shared/pipeline-types";

function createLibrary(rootPrefix: string, fileCount: number): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), rootPrefix));
  const mediaDir = path.join(root, "media");
  fs.mkdirSync(mediaDir);
  for (let i = 0; i < fileCount; i += 1) {
    const variant = E2E_JPEG_VARIANTS_BASE64[i % E2E_JPEG_VARIANTS_BASE64.length];
    fs.writeFileSync(
      path.join(mediaDir, `img-${String(i).padStart(4, "0")}.jpg`),
      Buffer.from(variant!, "base64"),
    );
  }
  return root;
}

function removeDir(root: string): void {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function addLibrary(
  electronApp: import("@playwright/test").ElectronApplication,
  mainWindow: import("@playwright/test").Page,
  root: string,
): Promise<void> {
  await mockFolderDialog(electronApp, root);
  await mainWindow.getByText("Add library folder").click();
}

async function startManualMetadataScanFromRootMenu(
  mainWindow: import("@playwright/test").Page,
  rootPath: string,
): Promise<void> {
  const normalized = path.normalize(rootPath);
  const rootButton = mainWindow.getByRole("button", { name: normalized, exact: true });
  const row = rootButton.locator("..").locator("..");
  await row.hover();
  await row.getByRole("button", { name: "More", exact: true }).click();
  await mainWindow.getByRole("button", { name: "Scan for file changes", exact: true }).click();
  const includeSubfolders = mainWindow.getByRole("checkbox", { name: /Include sub-folders/i });
  await expect(includeSubfolders).toBeVisible();
  await includeSubfolders.check();
  await mainWindow.locator('[title="Start metadata scan"]').first().click();
}

async function getActiveJobs(
  mainWindow: import("@playwright/test").Page,
): Promise<PipelineQueueSnapshot> {
  return mainWindow.evaluate(async () => window.desktopApi.pipelines.getSnapshot());
}

function getRunningJobId(snapshot: PipelineQueueSnapshot, pipelineId: string): string | null {
  for (const bundle of snapshot.running) {
    for (const job of bundle.jobs) {
      if (job.pipelineId === pipelineId && job.state === "running") {
        return job.jobId;
      }
    }
  }
  return null;
}

test("manual metadata scan keeps running across folder selection; auto-scan is skipped", async ({
  electronApp,
  mainWindow,
}) => {
  const manualRoot = createLibrary("emk-manual-scan-", 3000);
  const secondRoot = createLibrary("emk-second-select-", 4);

  try {
    await addLibrary(electronApp, mainWindow, manualRoot);
    await addLibrary(electronApp, mainWindow, secondRoot);

    await clickSidebarLibraryRoot(mainWindow, manualRoot);
    await startManualMetadataScanFromRootMenu(mainWindow, manualRoot);

    await expect
      .poll(
        async () => {
          const jobs = await getActiveJobs(mainWindow);
          return getRunningJobId(jobs, "metadata-scan");
        },
        { timeout: 30_000 },
      )
      .not.toBe(null);

    await clickSidebarLibraryRoot(mainWindow, secondRoot);
    await mainWindow.waitForTimeout(2_000);

    const jobsAfterSelection = await getActiveJobs(mainWindow);
    const metadataJobId = getRunningJobId(jobsAfterSelection, "metadata-scan");
    expect(metadataJobId).not.toBe(null);

    if (metadataJobId) {
      await mainWindow.evaluate(async (jobId) => {
        await window.desktopApi.pipelines.cancelJob(jobId);
      }, metadataJobId);
    }

    await expect
      .poll(
        async () => {
          const jobs = await getActiveJobs(mainWindow);
          return getRunningJobId(jobs, "metadata-scan");
        },
        { timeout: 30_000 },
      )
      .toBe(null);
  } finally {
    removeDir(manualRoot);
    removeDir(secondRoot);
  }
});
