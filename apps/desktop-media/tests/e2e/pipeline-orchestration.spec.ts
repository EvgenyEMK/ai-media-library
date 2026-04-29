import { test, expect } from "./fixtures/app-fixture";

/**
 * E2E coverage for the Phase 1-6 pipeline orchestration system:
 *   - The renderer can enqueue a preset bundle through `window.desktopApi.pipelines`.
 *   - Lifecycle / queue-changed / job-progress events are forwarded to the renderer.
 *   - The central queue slice and the new {@link PipelineQueueCards} surface in the
 *     `DesktopProgressDock` show the bundle and follow it through to completion.
 *
 * We deliberately use the `path-rule-only` preset because its single pipeline
 * (`path-rule-extraction`) reads only from the local SQLite catalog — no
 * geocoder, ONNX, or Ollama dependencies — so the scheduler runs end-to-end
 * with an empty E2E user-data directory in a few hundred milliseconds.
 */
test.describe("Pipeline orchestration — central scheduler", () => {
  test("enqueueing a single-pipeline preset surfaces in the dock and completes", async ({
    mainWindow,
  }) => {
    // Subscribe to lifecycle and queue-changed events from the page so we can
    // assert exactly which transitions the scheduler emitted.
    await mainWindow.evaluate(() => {
      // @ts-expect-error attach test helpers
      window.__pipelineLifecycle = [];
      // @ts-expect-error attach test helpers
      window.__pipelineSnapshots = [];
      // @ts-expect-error attach test helpers
      window.__pipelineUnsubLifecycle = window.desktopApi.pipelines.onLifecycle((evt) => {
        // @ts-expect-error
        window.__pipelineLifecycle.push(evt);
      });
      // @ts-expect-error
      window.__pipelineUnsubQueue = window.desktopApi.pipelines.onQueueChanged((snap) => {
        // @ts-expect-error
        window.__pipelineSnapshots.push(snap);
      });
    });

    try {
      const enqueueResult = await mainWindow.evaluate(async () => {
        return window.desktopApi.pipelines.enqueueBundle({
          kind: "preset",
          payload: { presetId: "path-rule-only", args: {} },
        });
      });
      expect(enqueueResult.ok).toBe(true);

      // Poll until the scheduler emits a terminal lifecycle event (the
      // scheduler models all terminal states as `bundle-finished` carrying a
      // `state` field).
      await expect
        .poll(
          async () =>
            mainWindow.evaluate(() => {
              // @ts-expect-error
              const log: Array<{ type: string }> = window.__pipelineLifecycle;
              return log.some((e) => e.type === "bundle-finished");
            }),
          { timeout: 30_000, intervals: [200, 500] },
        )
        .toBe(true);

      const finalLifecycleTypes = (await mainWindow.evaluate(() => {
        // @ts-expect-error
        return (window.__pipelineLifecycle as Array<{ type: string }>).map((e) => e.type);
      })) as string[];

      // We expect at minimum: bundle-queued -> bundle-started -> job-started ->
      // job-finished -> bundle-finished. Order is not strictly asserted but
      // each milestone must appear.
      expect(finalLifecycleTypes).toEqual(
        expect.arrayContaining([
          "bundle-queued",
          "bundle-started",
          "job-started",
          "job-finished",
          "bundle-finished",
        ]),
      );

      // The dock should now show the bundle under "Recently finished".
      const recentSection = mainWindow.getByLabel("Pipeline queue");
      await expect(recentSection).toBeVisible();
      await expect(
        recentSection.getByText("Extract dates from filenames", { exact: true }),
      ).toBeVisible();
      await expect(recentSection.getByText("Completed", { exact: true })).toBeVisible();

      // The final scheduler snapshot must show the bundle in `recent` and
      // empty `running` / `queued` arrays.
      const lastSnapshot = await mainWindow.evaluate(() => {
        // @ts-expect-error
        const snaps: Array<unknown> = window.__pipelineSnapshots;
        return snaps[snaps.length - 1];
      });
      expect(lastSnapshot).toBeTruthy();
      expect((lastSnapshot as { running: unknown[] }).running.length).toBe(0);
      expect((lastSnapshot as { queued: unknown[] }).queued.length).toBe(0);
      expect((lastSnapshot as { recent: unknown[] }).recent.length).toBeGreaterThanOrEqual(1);
    } finally {
      await mainWindow.evaluate(() => {
        // @ts-expect-error
        window.__pipelineUnsubLifecycle?.();
        // @ts-expect-error
        window.__pipelineUnsubQueue?.();
      });
    }
  });

  test("idle dock shows a slim Run pipelines button that opens the sheet", async ({
    mainWindow,
  }) => {
    const idleBar = mainWindow.getByLabel("Background operations idle");
    await expect(idleBar).toBeVisible();
    const runPipelinesButton = idleBar.getByRole("button", { name: "Run pipelines" });
    await expect(runPipelinesButton).toBeVisible();
    await runPipelinesButton.click();

    const dialog = mainWindow.getByRole("dialog", { name: "Run pipelines" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("an unknown preset id is rejected without enqueuing anything", async ({ mainWindow }) => {
    const result = await mainWindow.evaluate(async () => {
      return window.desktopApi.pipelines.enqueueBundle({
        kind: "preset",
        payload: { presetId: "this-preset-does-not-exist", args: {} },
      });
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.kind).toBe("unknown-pipeline");
    }

    const snap = await mainWindow.evaluate(() =>
      window.desktopApi.pipelines.getSnapshot(),
    );
    expect(snap.running.length).toBe(0);
    expect(snap.queued.length).toBe(0);
  });
});

test.describe("Pipeline orchestration — chained bundle with output→input binding", () => {
  test.use({ e2eGeocoderStub: true });

  test("path-and-geo preset runs path-rule-extraction then geocoder-init then gps-geocode", async ({
    mainWindow,
  }) => {
    await mainWindow.evaluate(() => {
      // @ts-expect-error
      window.__pipelineLifecycle = [];
      // @ts-expect-error
      window.__pipelineUnsubLifecycle = window.desktopApi.pipelines.onLifecycle((evt) => {
        // @ts-expect-error
        window.__pipelineLifecycle.push(evt);
      });
    });

    try {
      const result = await mainWindow.evaluate(async () => {
        return window.desktopApi.pipelines.enqueueBundle({
          kind: "preset",
          payload: { presetId: "path-and-geo", args: {} },
        });
      });
      expect(result.ok).toBe(true);

      // Wait for terminal bundle event. Allow more time because geocoder-init
      // talks to the stub but still goes through async I/O.
      await expect
        .poll(
          async () =>
            mainWindow.evaluate(() => {
              // @ts-expect-error
              return (window.__pipelineLifecycle as Array<{ type: string }>).some(
                (e) => e.type === "bundle-finished",
              );
            }),
          { timeout: 60_000, intervals: [250, 500] },
        )
        .toBe(true);

      const events = (await mainWindow.evaluate(() => {
        // @ts-expect-error
        return window.__pipelineLifecycle as Array<{
          type: string;
          pipelineId?: string;
        }>;
      })) as Array<{ type: string; pipelineId?: string }>;

      const startedPipelines = events
        .filter((e) => e.type === "job-started" && e.pipelineId)
        .map((e) => e.pipelineId);

      // Order matters — bundle is strictly sequential.
      expect(startedPipelines).toEqual([
        "path-rule-extraction",
        "geocoder-init",
        "gps-geocode",
      ]);

      // The breadcrumb in the dock should display all three job ids.
      const recentSection = mainWindow.getByLabel("Pipeline queue");
      await expect(recentSection).toBeVisible();
      for (const pipeline of ["path-rule-extraction", "geocoder-init", "gps-geocode"]) {
        await expect(recentSection.getByText(pipeline).first()).toBeVisible();
      }
    } finally {
      await mainWindow.evaluate(() => {
        // @ts-expect-error
        window.__pipelineUnsubLifecycle?.();
      });
    }
  });
});
