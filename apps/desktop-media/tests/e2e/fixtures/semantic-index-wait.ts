import type { Page } from "@playwright/test";

/** Wait until no `indexFolderSemanticEmbeddings` job is holding the global lock in main. */
export async function waitForSemanticIndexIdle(page: Page, timeoutMs = 300_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const idle = await page.evaluate(async () => {
      const s = await window.desktopApi.getSemanticEmbeddingStatus();
      return !s.indexingInProgress && s.currentJobId === null;
    });
    if (idle) return;
    await page.waitForTimeout(300);
  }
  throw new Error("Timed out waiting for semantic indexing to finish");
}
