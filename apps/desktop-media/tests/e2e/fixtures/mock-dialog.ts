import type { ElectronApplication } from "@playwright/test";

/**
 * Replace the `selectLibraryFolder` IPC handler with one that returns
 * a predetermined folder path, bypassing the native file dialog.
 */
export async function mockFolderDialog(app: ElectronApplication, folderPath: string): Promise<void> {
  await app.evaluate(async ({ ipcMain }, path) => {
    ipcMain.removeHandler("media:select-library-folder");
    ipcMain.handle("media:select-library-folder", async () => path);
  }, folderPath);
}
