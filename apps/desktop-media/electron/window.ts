import path from "node:path";
import { BrowserWindow } from "electron";
import { resetFrameSendErrorFlag } from "./ipc/progress-emitters";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(DEV_SERVER_URL);

function loadRenderer(window: BrowserWindow): void {
  if (isDev && DEV_SERVER_URL) {
    const tryLoad = (attempt = 0) => {
      window.loadURL(DEV_SERVER_URL).catch(() => {
        if (attempt < 30) {
          setTimeout(() => tryLoad(attempt + 1), 500);
        }
      });
    };
    tryLoad();
  } else {
    const rendererIndexPath = path.resolve(__dirname, "../dist-renderer/index.html");
    window.loadFile(rendererIndexPath).catch((error) => {
      console.error("Failed to load renderer index:", rendererIndexPath, error);
    });
  }
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // In dev the renderer loads from http://localhost so file:// images are
      // cross-origin. Relaxing webSecurity in dev lets them load normally.
      // Production loads from file:// so same-origin policy is fine.
      webSecurity: !isDev,
    },
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    console.warn(
      `[window] renderer process gone reason=${details.reason} exitCode=${details.exitCode}, reloading…`,
    );
    resetFrameSendErrorFlag();
    loadRenderer(window);
  });

  window.on("unresponsive", () => {
    console.warn("[window] renderer became unresponsive");
  });

  window.on("responsive", () => {
    console.log("[window] renderer is responsive again");
  });

  loadRenderer(window);

  return window;
}
