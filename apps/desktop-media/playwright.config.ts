import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  /** Electron cold start + first window on GitHub windows-latest often needs >2m under load. */
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
});
