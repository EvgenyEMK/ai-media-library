import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  /** Electron cold start + first paint can exceed 30s on Windows CI or dev machines. */
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
});
