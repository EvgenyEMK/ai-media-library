import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-real",
  /** Real GeoNames bootstrap can download and parse multi-GB data on first run. */
  timeout: 3_600_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
});
