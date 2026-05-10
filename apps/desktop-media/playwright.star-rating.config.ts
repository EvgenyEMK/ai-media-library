import { defineConfig } from "@playwright/test";

/**
 * Standalone Playwright config for the star-rating embedded-metadata suite.
 *
 * These tests are excluded from the default `tests/e2e/` smoke and full E2E
 * suites because of an order-dependent race between the renderer's auto-persist
 * Zustand subscriber and the main-process settings file. The race only
 * manifests when other specs run before/around this one, and clobbers
 * `folderScanning.writeEmbeddedMetadataOnUserEdit=true` mid-test.
 *
 * Run via `pnpm --filter @emk/desktop-media test:e2e:star-rating`.
 */
export default defineConfig({
  testDir: "./tests/e2e-standalone",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
});
