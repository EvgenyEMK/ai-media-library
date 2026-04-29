import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test as base, type ElectronApplication, type Page, _electron as electron } from "@playwright/test";
import { startMockOllamaServer, type MockOllamaConfig } from "./mock-ollama";

const MAIN_JS = path.resolve(__dirname, "../../../dist-electron/main.js");

interface AppFixtures {
  electronApp: ElectronApplication;
  mainWindow: Page;
}

interface AppOptions {
  ollamaMock: MockOllamaConfig;
  /** Append `Filename: <basename>` to photo analysis prompts (pair with `e2eFilenameBasedAnalysis` mock). */
  e2eFilenameInAnalysisPrompt?: boolean;
  /**
   * When true, `initGeocoder` skips fetching GeoNames (only when `NODE_ENV=test` in main).
   * Use for Playwright tests of the settings/download UX without multi‑GB downloads.
   */
  e2eGeocoderStub?: boolean;
  /** Pre-seed minimal GeoNames cache files so settings can exercise the local-copy branch. */
  e2eGeocoderCachedData?: boolean;
  /** Force model download failure path for ensureDetectorModel in test mode. */
  e2eFailFaceModelDownload?: boolean;
}

/**
 * Shared Playwright fixture that launches the built Electron app and
 * provides the `electronApp` handle and its first `mainWindow` page.
 *
 * Prerequisites:
 *   pnpm --filter @emk/desktop-media build
 */
export const test = base.extend<AppFixtures & AppOptions>({
  ollamaMock: [{ failFirstChatRequests: 0 }, { option: true }],
  e2eFilenameInAnalysisPrompt: [false, { option: true }],
  e2eGeocoderStub: [false, { option: true }],
  e2eGeocoderCachedData: [false, { option: true }],
  e2eFailFaceModelDownload: [false, { option: true }],

  electronApp: async (
    {
      ollamaMock,
      e2eFilenameInAnalysisPrompt,
      e2eGeocoderStub,
      e2eGeocoderCachedData,
      e2eFailFaceModelDownload,
    },
    use,
  ) => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "emk-e2e-userdata-"));
    const runtimeRootPath = fs.mkdtempSync(path.join(os.tmpdir(), "emk-e2e-runtime-"));
    if (e2eGeocoderCachedData) {
      const citiesDir = path.join(runtimeRootPath, "geonames", "cities1000");
      const admin1Dir = path.join(runtimeRootPath, "geonames", "admin1_codes");
      const admin2Dir = path.join(runtimeRootPath, "geonames", "admin2_codes");
      fs.mkdirSync(citiesDir, { recursive: true });
      fs.mkdirSync(admin1Dir, { recursive: true });
      fs.mkdirSync(admin2Dir, { recursive: true });
      fs.writeFileSync(path.join(citiesDir, "cities1000_2026-04-24.txt"), "cities");
      fs.writeFileSync(path.join(admin1Dir, "admin1CodesASCII_2026-04-24.txt"), "admin1");
      fs.writeFileSync(path.join(admin2Dir, "admin2CodesASCII_2026-04-24.txt"), "admin2");
    }
    const ollama = await startMockOllamaServer(ollamaMock);
    const app = await electron.launch({
      args: [MAIN_JS],
      env: {
        ...process.env,
        NODE_ENV: "test",
        EMK_DESKTOP_USER_DATA_PATH: userDataPath,
        EMK_DESKTOP_RUNTIME_ROOT_PATH: runtimeRootPath,
        EMK_OLLAMA_BASE_URL: ollama.baseUrl,
        ...(e2eFilenameInAnalysisPrompt ? { EMK_E2E_ANALYSIS_APPENDED_BASENAME: "1" } : {}),
        ...(e2eGeocoderStub ? { EMK_E2E_GEOCODER_STUB: "1" } : {}),
        ...(e2eFailFaceModelDownload ? { EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD: "1" } : {}),
      },
    });

    try {
      await use(app);
    } finally {
      await app.close();
      await ollama.close();
      fs.rmSync(userDataPath, { recursive: true, force: true });
      fs.rmSync(runtimeRootPath, { recursive: true, force: true });
    }
  },

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 180_000 });
    await window.waitForLoadState("domcontentloaded");
    await use(window);
  },
});

export { expect } from "@playwright/test";
