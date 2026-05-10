import { describe, it, expect } from "vitest";
import type { AppSettings } from "../../shared/ipc";
import { DEFAULT_APP_SETTINGS } from "../../shared/ipc";
import { createDesktopStore } from "../stores/desktop-store";
import { applyPersistedAppSettingsToStore } from "./apply-persisted-app-settings";

describe("applyPersistedAppSettingsToStore", () => {
  it("updates folderScanningSettings.detectLocationFromGps from persisted settings", () => {
    const store = createDesktopStore();
    expect(store.getState().folderScanningSettings.detectLocationFromGps).toBe(false);

    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      clientId: "test-client",
      folderScanning: {
        ...DEFAULT_APP_SETTINGS.folderScanning,
        detectLocationFromGps: true,
      },
    };
    applyPersistedAppSettingsToStore(store, settings);
    expect(store.getState().folderScanningSettings.detectLocationFromGps).toBe(true);
  });
});
