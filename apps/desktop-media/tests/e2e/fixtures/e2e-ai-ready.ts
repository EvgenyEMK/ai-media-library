import type { Page } from "@playwright/test";

/**
 * Semantic search uses Nomic ONNX for vision; text queries use either Ollama
 * (startup probe → textEmbeddingReady) or ONNX (onnxTextEmbeddingReady).
 * Wait until the paths the E2E needs are actually usable.
 */
export async function waitForSemanticSearchAiReady(
  page: Page,
  timeoutMs = 300_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate(async () => {
      const s = await window.desktopApi.getSemanticEmbeddingStatus();
      const textOk = s.textEmbeddingReady || s.onnxTextEmbeddingReady;
      return textOk && s.visionOnnxReady;
    });
    if (ok) return;
    await page.waitForTimeout(1_000);
  }
  const snap = await page.evaluate(async () => window.desktopApi.getSemanticEmbeddingStatus());
  throw new Error(
    `Semantic search AI not ready after ${timeoutMs}ms: ${JSON.stringify(snap)}`,
  );
}

/** ArcFace session may appear only after native models finish downloading on first run. */
export async function waitForArcFaceModelReady(
  page: Page,
  timeoutMs = 300_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate(async () => {
      const s = await window.desktopApi.getEmbeddingModelStatus();
      return s.loaded === true;
    });
    if (ok) return;
    await page.waitForTimeout(1_000);
  }
  const snap = await page.evaluate(async () => window.desktopApi.getEmbeddingModelStatus());
  throw new Error(
    `ArcFace embedding model not ready after ${timeoutMs}ms: ${JSON.stringify(snap)}`,
  );
}
