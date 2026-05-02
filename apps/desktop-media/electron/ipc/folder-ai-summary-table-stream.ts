import type { WebContents } from "electron";
import { ipcMain } from "electron";
import {
  IPC_CHANNELS,
  type FolderAiSummaryStreamEvent,
  type FolderFaceSummaryStreamRowSpec,
} from "../../src/shared/ipc";
import { getFolderAiCoverage } from "../db/folder-ai-coverage";
import { readFolderChildren } from "../fs-media";
import { buildFolderFaceSummaryStreamSpecs, streamFaceSummaryProcessingOrder } from "./folder-face-summary-stream";

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

const activeJobs = new Map<string, { cancelled: boolean }>();

function sendProgress(sender: WebContents, payload: FolderAiSummaryStreamEvent): void {
  sender.send(IPC_CHANNELS.folderAiSummaryStreamProgress, payload);
}

function runAiSummaryStream(sender: WebContents, jobId: string, specs: FolderFaceSummaryStreamRowSpec[]): void {
  void (async () => {
    try {
      const orderedSpecs = streamFaceSummaryProcessingOrder(specs);
      for (const spec of orderedSpecs) {
        const job = activeJobs.get(jobId);
        if (!job || job.cancelled) {
          sendProgress(sender, { kind: "error", jobId, message: "cancelled" });
          return;
        }
        const coverage = getFolderAiCoverage({
          folderPath: spec.folderPath,
          recursive: spec.recursive,
        });
        sendProgress(sender, { kind: "row", jobId, rowId: spec.rowId, coverage });
        await yieldToEventLoop();
      }
      sendProgress(sender, { kind: "done", jobId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Folder AI summary stream failed";
      sendProgress(sender, { kind: "error", jobId, message });
    } finally {
      activeJobs.delete(jobId);
    }
  })();
}

export function registerFolderAiSummaryStreamHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.startFolderAiSummaryStream,
    async (event, folderPath: unknown, jobId: unknown) => {
      const wid = typeof jobId === "string" && jobId.trim().length > 0 ? jobId.trim() : "";
      const normalized = typeof folderPath === "string" ? folderPath.trim() : "";

      if (!wid) {
        return { folderPath: normalized, jobId: "", rows: [] as FolderFaceSummaryStreamRowSpec[] };
      }

      if (!normalized) {
        sendProgress(event.sender, { kind: "done", jobId: wid });
        return { folderPath: "", jobId: wid, rows: [] };
      }

      activeJobs.set(wid, { cancelled: false });
      const children = await readFolderChildren(normalized);
      const rows = buildFolderFaceSummaryStreamSpecs(normalized, children);
      runAiSummaryStream(event.sender, wid, rows);

      return { folderPath: normalized, jobId: wid, rows };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelFolderAiSummaryStream, (_event, jobId: unknown) => {
    const wid = typeof jobId === "string" ? jobId.trim() : "";
    if (!wid) return false;
    const job = activeJobs.get(wid);
    if (!job) return false;
    job.cancelled = true;
    return true;
  });
}
