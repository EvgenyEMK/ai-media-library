import type { WebContents } from "electron";
import { ipcMain } from "electron";
import {
  FOLDER_FACE_SUMMARY_STREAM_ROW_IDS,
  FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX,
  folderFaceSummarySubfolderRowId,
  IPC_CHANNELS,
  type FolderFaceSummaryStreamRowSpec,
  type FolderFaceSummaryStreamEvent,
} from "../../src/shared/ipc";
import { getFolderAiCoverage } from "../db/folder-ai-coverage";
import { getFolderFaceSummary } from "../db/folder-face-summary";
import { readFolderChildren } from "../fs-media";

export function buildFolderFaceSummaryStreamSpecs(
  normalizedFolderPath: string,
  children: Array<{ path: string; name: string }>,
): FolderFaceSummaryStreamRowSpec[] {
  if (children.length === 0) {
    return [
      {
        rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder,
        folderPath: normalizedFolderPath,
        name: "",
        recursive: false,
      },
    ];
  }
  const rows: FolderFaceSummaryStreamRowSpec[] = [
    {
      rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive,
      folderPath: normalizedFolderPath,
      name: "",
      recursive: true,
    },
    {
      rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect,
      folderPath: normalizedFolderPath,
      name: "",
      recursive: false,
    },
  ];
  for (const node of children) {
    rows.push({
      rowId: folderFaceSummarySubfolderRowId(node.path),
      folderPath: node.path,
      name: node.name,
      recursive: true,
    });
  }
  return rows;
}

/**
 * Order DB work so cheaper rows finish first: direct-only scope before full subtree rollup.
 * Table row order is unchanged; completion order differs so the UI can fill progressively.
 */
export function streamFaceSummaryProcessingOrder(
  specs: FolderFaceSummaryStreamRowSpec[],
): FolderFaceSummaryStreamRowSpec[] {
  if (specs.length <= 1) {
    return specs;
  }
  const direct = specs.find((s) => s.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect);
  const recursive = specs.find((s) => s.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive);
  const subfolders = specs.filter((s) => s.rowId.startsWith(FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX));
  const ordered: FolderFaceSummaryStreamRowSpec[] = [];
  if (direct) ordered.push(direct);
  if (recursive) ordered.push(recursive);
  ordered.push(...subfolders);
  return ordered.length === specs.length ? ordered : specs;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

const activeJobs = new Map<string, { cancelled: boolean }>();

function sendProgress(sender: WebContents, payload: FolderFaceSummaryStreamEvent): void {
  sender.send(IPC_CHANNELS.folderFaceSummaryProgress, payload);
}

function runFaceSummaryStream(sender: WebContents, jobId: string, specs: FolderFaceSummaryStreamRowSpec[]): void {
  void (async () => {
    try {
      const orderedSpecs = streamFaceSummaryProcessingOrder(specs);
      for (const spec of orderedSpecs) {
        const job = activeJobs.get(jobId);
        if (!job || job.cancelled) {
          sendProgress(sender, { kind: "error", jobId, message: "cancelled" });
          return;
        }
        const summary = getFolderFaceSummary({
          folderPath: spec.folderPath,
          recursive: spec.recursive,
        });
        const coverage = getFolderAiCoverage({
          folderPath: spec.folderPath,
          recursive: spec.recursive,
        });
        sendProgress(sender, { kind: "row", jobId, rowId: spec.rowId, summary, coverage });
        await yieldToEventLoop();
      }
      sendProgress(sender, { kind: "done", jobId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Face summary stream failed";
      sendProgress(sender, { kind: "error", jobId, message });
    } finally {
      activeJobs.delete(jobId);
    }
  })();
}

export function registerFolderFaceSummaryStreamHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.startFolderFaceSummaryStream,
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
      runFaceSummaryStream(event.sender, wid, rows);

      return { folderPath: normalized, jobId: wid, rows };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelFolderFaceSummaryStream, (_event, jobId: unknown) => {
    const wid = typeof jobId === "string" ? jobId.trim() : "";
    if (!wid) return false;
    const job = activeJobs.get(wid);
    if (!job) return false;
    job.cancelled = true;
    return true;
  });
}
