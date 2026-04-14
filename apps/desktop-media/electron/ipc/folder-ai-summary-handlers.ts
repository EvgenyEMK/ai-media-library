import { ipcMain } from "electron";
import { IPC_CHANNELS, type FolderAiSummaryReport } from "../../src/shared/ipc";
import { getFolderAiCoverage, getFolderAiRollupsForPaths } from "../db/folder-ai-coverage";
import { readFolderChildren } from "../fs-media";

export function registerFolderAiSummaryHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.getFolderAiSummaryReport,
    async (_event, folderPath: string): Promise<FolderAiSummaryReport> => {
      const normalized = folderPath?.trim();
      if (!normalized) {
        return {
          selectedWithSubfolders: getFolderAiCoverage({ folderPath: "", recursive: true }),
          selectedDirectOnly: getFolderAiCoverage({ folderPath: "", recursive: false }),
          subfolders: [],
        };
      }

      const selectedWithSubfolders = getFolderAiCoverage({ folderPath: normalized, recursive: true });
      const selectedDirectOnly = getFolderAiCoverage({ folderPath: normalized, recursive: false });
      const children = await readFolderChildren(normalized);
      const subfolders = children.map((node) => ({
        folderPath: node.path,
        name: node.name,
        coverage: getFolderAiCoverage({ folderPath: node.path, recursive: true }),
      }));

      return { selectedWithSubfolders, selectedDirectOnly, subfolders };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getFolderAiCoverage,
    async (_event, folderPath: string, recursive: boolean) => {
      const normalized = folderPath?.trim() ?? "";
      return getFolderAiCoverage({ folderPath: normalized, recursive: recursive === true });
    },
  );

  ipcMain.handle(IPC_CHANNELS.getFolderAiRollupsBatch, async (_event, folderPaths: unknown) => {
    if (!Array.isArray(folderPaths)) {
      return {};
    }
    const paths = folderPaths.filter((p): p is string => typeof p === "string");
    return getFolderAiRollupsForPaths(paths);
  });
}
