import { test, expect } from "./fixtures/app-fixture";

/**
 * Real first-time GeoNames fetch is ~2 GB and is not run in CI. With
 * `e2eGeocoderStub`, Playwright sets `EMK_E2E_GEOCODER_STUB=1` so the main process
 * emits the same progress events and completes init without GeoNames I/O (see
 * `reverse-geocoder.ts`). This verifies the confirm dialog, `initGeocoder` IPC,
 * progress events, and Background operations UI.
 */
test.use({ e2eGeocoderStub: true });

test.describe("GPS location database download flow", () => {
  test("confirming download enables GPS setting and completes init in Background operations", async ({
    mainWindow,
  }) => {
    await mainWindow.evaluate(() => {
      // @ts-expect-error - attach for tests
      window.__e2eGeocoderEvents = [];
      // @ts-expect-error - attach for tests
      window.__e2eGeocoderUnsub = window.desktopApi.onGeocoderInitProgress((e) => {
        // @ts-expect-error - attach for tests
        window.__e2eGeocoderEvents.push(e);
      });
    });

    try {
      await mainWindow.getByRole("navigation").getByText("Settings", { exact: true }).click();

      // Settings sections are `<details>` accordions (closed by default).
      await mainWindow.getByText("File metadata management", { exact: true }).click();

      const gpsCheckbox = mainWindow.getByRole("checkbox", {
        name: /Detect Country \/ City from GPS coordinates/i,
      });
      await expect(gpsCheckbox).toBeVisible();
      await expect(gpsCheckbox).not.toBeChecked();

      await gpsCheckbox.click();

      await expect(mainWindow.getByText("Download location data?", { exact: true })).toBeVisible();
      await expect(
        mainWindow.getByText(/approximately 2 GB of geographic data/i),
      ).toBeVisible();

      await mainWindow.getByRole("button", { name: "Download", exact: true }).click();

      await expect(gpsCheckbox).toBeChecked();

      await expect(mainWindow.getByRole("region", { name: /Background operations/i })).toBeVisible();

      await expect(
        mainWindow.getByRole("heading", { name: "GPS location database" }),
      ).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        mainWindow.getByText("Location database ready.", { exact: true }),
      ).toBeVisible({
        timeout: 15_000,
      });

      const statuses = await mainWindow.evaluate(() => {
        // @ts-expect-error - attached in test
        const events: Array<{ status?: string }> = window.__e2eGeocoderEvents ?? [];
        return events.map((e) => e.status);
      });

      expect(statuses).toContain("downloading");
      expect(statuses).toContain("parsing");
      expect(statuses).toContain("ready");
    } finally {
      await mainWindow.evaluate(() => {
        // @ts-expect-error - attached in test
        window.__e2eGeocoderUnsub?.();
      });
    }
  });
});
