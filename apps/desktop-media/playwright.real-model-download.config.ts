import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-real",
  testMatch: ["real-ai-model-download.spec.ts"],
  /** Real ONNX model downloads can take several minutes on a cold cache. */
  timeout: 1_800_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
});
