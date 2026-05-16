import { expect, test } from "./fixtures/app-fixture";
import {
  E2E_MEDIA_MIXED_DIR,
  hasE2eMixedMediaAssets,
  openE2eMixedMediaLibrary,
  readMixedMediaNames,
  switchToGridView,
  switchToListView,
} from "./fixtures/e2e-media-mixed-library";

const mixedAssetsMissing = `Missing mixed media fixtures under ${E2E_MEDIA_MIXED_DIR}`;
const autoPlayVideoOnSelectionLabel = "Automatically start playback on video selection";

async function openViewerFromListRow(mainWindow: import("@playwright/test").Page, title: string): Promise<void> {
  // Prefer role + exact name over `hasText` (substring) matching; click the title so the event
  // bubbles to the row `article` reliably on Windows CI (see dev push CI for viewer-video).
  const titleHeading = mainWindow.getByRole("heading", { level: 3, name: title, exact: true }).first();
  await expect(titleHeading).toBeVisible({ timeout: 15_000 });
  await titleHeading.scrollIntoViewIfNeeded();
  await titleHeading.click();
  await expect(mainWindow.locator(".media-swiper-theme")).toBeVisible({ timeout: 30_000 });
}

async function openViewerFromGridByTitle(mainWindow: import("@playwright/test").Page, title: string): Promise<void> {
  const grid = mainWindow.getByTestId("desktop-folder-thumbnails-grid");
  await grid.getByText(title, { exact: true }).click({ force: true });
  await expect(mainWindow.locator(".media-swiper-theme")).toBeVisible({ timeout: 25_000 });
}

async function currentViewerVideoPaused(mainWindow: import("@playwright/test").Page): Promise<boolean | null> {
  return mainWindow.evaluate(() => {
    // `[controls]` pins to the main viewer's slide video; the thumb rail's active <video>
    // also lives under `.swiper-slide-active` but is muted/aria-hidden without controls.
    const video = document.querySelector(
      ".media-swiper-theme .swiper-slide-active video[controls]",
    ) as HTMLVideoElement | null;
    return video ? video.paused : null;
  });
}

async function advanceUntilVideo(
  mainWindow: import("@playwright/test").Page,
  options: { expectedPaused: boolean; maxSteps?: number; timeoutPerStepMs?: number },
): Promise<void> {
  const maxSteps = options.maxSteps ?? 6;
  const timeoutPerStepMs = options.timeoutPerStepMs ?? 5_000;

  for (let i = 0; i < maxSteps; i += 1) {
    await mainWindow.getByRole("button", { name: "Next item" }).click();
    try {
      await expect
        .poll(async () => currentViewerVideoPaused(mainWindow), { timeout: timeoutPerStepMs })
        .toBe(options.expectedPaused);
      return;
    } catch {
      // The next item can be another image. Continue until a video slide becomes active.
    }
  }

  throw new Error(`Did not reach a video slide after ${maxSteps} Next item clicks`);
}

async function selectImageBeforeVideoInViewer(
  mainWindow: import("@playwright/test").Page,
): Promise<void> {
  const selected = await mainWindow.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.media-swiper-theme button[aria-label^="Go to item"]'),
    );
    const videoIndex = buttons.findIndex(
      (button) => button.querySelector("video") || button.textContent?.includes("Video"),
    );
    if (videoIndex < 0) {
      return false;
    }
    for (let offset = 1; offset < buttons.length; offset += 1) {
      const candidate = buttons[(videoIndex - offset + buttons.length) % buttons.length];
      if (candidate?.querySelector("img")) {
        candidate.click();
        return true;
      }
    }
    return false;
  });
  expect(selected).toBe(true);
  await expect(mainWindow.locator(".media-swiper-theme .swiper-slide-active img[data-emk-fit-mode]")).toBeVisible();
}

async function setAutoPlayVideoOnSelection(
  mainWindow: import("@playwright/test").Page,
  enabled: boolean,
): Promise<void> {
  await mainWindow.getByText("Settings", { exact: true }).click();
  const mediaViewerSection = mainWindow.locator("details").filter({ hasText: "Image / Video viewer" }).first();
  const sectionOpen = await mediaViewerSection.evaluate((el) => el.hasAttribute("open"));
  if (!sectionOpen) {
    await mediaViewerSection.locator("summary").click();
  }
  const checkbox = mainWindow.getByLabel(autoPlayVideoOnSelectionLabel, { exact: true });
  await expect(checkbox).toBeVisible({ timeout: 10_000 });
  await checkbox.setChecked(enabled);
  await expect
    .poll(
      async () =>
        mainWindow.evaluate(async () => {
          const settings = await window.desktopApi.getSettings();
          return settings.mediaViewer.autoPlayVideoOnOpen;
        }),
      { timeout: 10_000 },
    )
    .toBe(enabled);
  await mainWindow.getByText("Folders", { exact: true }).click();
}

test.describe("Viewer mixed media", () => {
  test("opening video from folder grid opens viewer and auto-plays", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);

    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await switchToGridView(mainWindow);

    const { videoNames } = await readMixedMediaNames(mainWindow);
    expect(videoNames.length).toBeGreaterThan(0);
    await openViewerFromGridByTitle(mainWindow, videoNames[0]);

    await expect
      .poll(async () => currentViewerVideoPaused(mainWindow), { timeout: 10_000 })
      .toBe(false);
  });

  test("viewer thumb strip shows video preview (not only main stage)", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);

    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await switchToGridView(mainWindow);

    const { videoNames } = await readMixedMediaNames(mainWindow);
    expect(videoNames.length).toBeGreaterThan(0);
    await openViewerFromGridByTitle(mainWindow, videoNames[0]);

    await expect
      .poll(
        async () =>
          mainWindow.evaluate(() => {
            const root = document.querySelector(".media-swiper-theme");
            if (!root) return 0;
            return root.querySelectorAll("video").length;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(2);
  });

  test("opening video from folder list opens viewer and auto-plays", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);

    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await switchToListView(mainWindow);

    const { videoNames } = await readMixedMediaNames(mainWindow);
    expect(videoNames.length).toBeGreaterThan(0);
    await openViewerFromListRow(mainWindow, videoNames[0]);

    await expect
      .poll(async () => currentViewerVideoPaused(mainWindow), { timeout: 10_000 })
      .toBe(false);
  });

  test("manual navigation to video auto-plays when setting is enabled", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);

    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await switchToListView(mainWindow);

    const { imageNames } = await readMixedMediaNames(mainWindow);
    expect(imageNames.length).toBeGreaterThan(0);
    await openViewerFromListRow(mainWindow, imageNames[0]);
    await selectImageBeforeVideoInViewer(mainWindow);

    await advanceUntilVideo(mainWindow, { expectedPaused: false, maxSteps: 1 });
  });

  test("clicking video in viewer strip auto-plays when setting is enabled", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);

    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await switchToListView(mainWindow);

    const { imageNames } = await readMixedMediaNames(mainWindow);
    expect(imageNames.length).toBeGreaterThan(0);
    await openViewerFromListRow(mainWindow, imageNames[0]);

    const videoThumb = mainWindow.locator(".media-swiper-theme .swiper-slide button video").first();
    await expect(videoThumb).toBeVisible({ timeout: 10_000 });
    await videoThumb.click({ force: true });

    await expect
      .poll(async () => currentViewerVideoPaused(mainWindow), { timeout: 10_000 })
      .toBe(false);
  });

  test("manual navigation to video does not auto-play when setting is disabled", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);

    await setAutoPlayVideoOnSelection(mainWindow, false);
    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await expect
      .poll(
        async () =>
          mainWindow.evaluate(async () => {
            const settings = await window.desktopApi.getSettings();
            return settings.mediaViewer.autoPlayVideoOnOpen;
          }),
        { timeout: 15_000 },
      )
      .toBe(false);
    await switchToListView(mainWindow);

    const { imageNames } = await readMixedMediaNames(mainWindow);
    expect(imageNames.length).toBeGreaterThan(0);
    await openViewerFromListRow(mainWindow, imageNames[0]);
    await selectImageBeforeVideoInViewer(mainWindow);

    await advanceUntilVideo(mainWindow, { expectedPaused: true, maxSteps: 1, timeoutPerStepMs: 25_000 });
  });

  test("slideshow mode advances after video playback ends", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);

    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await switchToListView(mainWindow);

    const { videoNames } = await readMixedMediaNames(mainWindow);
    expect(videoNames.length).toBeGreaterThan(0);
    await openViewerFromListRow(mainWindow, videoNames[0]);

    await mainWindow.getByRole("button", { name: "Play slideshow" }).click();

    await expect
      .poll(
        async () =>
          mainWindow.evaluate(() => {
            const activeVideo = document.querySelector(
              ".media-swiper-theme .swiper-slide-active video",
            ) as HTMLVideoElement | null;
            return activeVideo ? "video" : "non-video";
          }),
        { timeout: 20_000 },
      )
      .toBe("non-video");
  });

  test("slideshow started on image eventually plays a video slide", async ({ electronApp, mainWindow }) => {
    test.skip(!hasE2eMixedMediaAssets(), mixedAssetsMissing);
    test.setTimeout(300_000);

    await openE2eMixedMediaLibrary(electronApp, mainWindow);
    await switchToListView(mainWindow);

    const { imageNames } = await readMixedMediaNames(mainWindow);
    expect(imageNames.length).toBeGreaterThan(0);
    await openViewerFromListRow(mainWindow, imageNames[0]);
    await selectImageBeforeVideoInViewer(mainWindow);
    await mainWindow.getByRole("button", { name: "Play slideshow" }).click();

    await expect
      .poll(async () => currentViewerVideoPaused(mainWindow), { timeout: 240_000 })
      .toBe(false);
  });
});
