import type { Page } from "@playwright/test";

type StableSettingsKind = "gps" | "embeddedWrite" | "photoDownscale";

async function waitForStableSettingsFlag(mainWindow: Page, options: {
  kind: StableSettingsKind;
  enabled: boolean;
  expectedLibraryRoots?: string[];
  errorMessage: string;
}): Promise<void> {
  await mainWindow.evaluate(async (opts) => {
    const apply = async (): Promise<void> => {
      const settings = await window.desktopApi.getSettings();
      const libraryRoots = Array.from(
        new Set([...settings.libraryRoots, ...(opts.expectedLibraryRoots ?? [])]),
      );
      await window.desktopApi.saveSettings({
        ...settings,
        libraryRoots,
        folderScanning: {
          ...settings.folderScanning,
          detectLocationFromGps:
            opts.kind === "gps" ? opts.enabled : settings.folderScanning.detectLocationFromGps,
          writeEmbeddedMetadataOnUserEdit:
            opts.kind === "embeddedWrite"
              ? opts.enabled
              : settings.folderScanning.writeEmbeddedMetadataOnUserEdit,
        },
        photoAnalysis: {
          ...settings.photoAnalysis,
          downscaleBeforeLlm:
            opts.kind === "photoDownscale" ? opts.enabled : settings.photoAnalysis.downscaleBeforeLlm,
        },
      });
    };

    const isReady = async (): Promise<boolean> => {
      const saved = await window.desktopApi.getSettings();
      const hasRoots = (opts.expectedLibraryRoots ?? []).every((root) =>
        saved.libraryRoots.includes(root),
      );
      if (!hasRoots) return false;
      if (opts.kind === "gps") return saved.folderScanning.detectLocationFromGps === opts.enabled;
      if (opts.kind === "embeddedWrite") {
        return saved.folderScanning.writeEmbeddedMetadataOnUserEdit === opts.enabled;
      }
      return saved.photoAnalysis.downscaleBeforeLlm === opts.enabled;
    };

    /** Photo downscale is toggled in Settings (Zustand + subscriber save). Forcing `saveSettings` here races with that save and can reorder `settingsSaved` so the store briefly reverts to the old flag — only poll disk. */
    const forceApply = opts.kind !== "photoDownscale";
    if (forceApply) {
      await apply();
    }
    const deadline = Date.now() + (opts.kind === "photoDownscale" ? 30_000 : 20_000);
    let stableChecks = 0;
    while (Date.now() < deadline) {
      if (await isReady()) {
        stableChecks += 1;
        if (stableChecks >= 3) {
          return;
        }
      } else {
        stableChecks = 0;
        if (forceApply) {
          await apply();
        }
      }
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 100);
      });
    }
    throw new Error(opts.errorMessage);
  }, options);
}

/**
 * Enables reverse-geocoding during scans and waits until main-process persistence + renderer sync reflect it.
 */
export async function enableGpsGeocodingSetting(
  mainWindow: Page,
  expectedLibraryRoots: string[] = [],
): Promise<void> {
  await waitForStableSettingsFlag(mainWindow, {
    kind: "gps",
    enabled: true,
    expectedLibraryRoots,
    errorMessage: "Failed to enable GPS geocoding setting.",
  });
  await mainWindow.evaluate(async () => {
    await window.desktopApi.initGeocoder();
  });
}

export async function waitForPhotoDownscaleSetting(mainWindow: Page, enabled: boolean): Promise<void> {
  await waitForStableSettingsFlag(mainWindow, {
    kind: "photoDownscale",
    enabled,
    errorMessage: "Failed to persist photo analysis downscale setting.",
  });
}

/**
 * Persists "write embedded metadata on user edit" and polls until `getSettings` matches, so E2E does not
 * star-rate while the renderer still has a stale `false` (same IPC/sync issue as GPS toggles).
 */
export async function setWriteEmbeddedMetadataOnUserEdit(
  mainWindow: Page,
  enabled: boolean,
  expectedLibraryRoots: string[] = [],
): Promise<void> {
  await waitForStableSettingsFlag(mainWindow, {
    kind: "embeddedWrite",
    enabled,
    expectedLibraryRoots,
    errorMessage: "Failed to persist writeEmbeddedMetadataOnUserEdit.",
  });
}
