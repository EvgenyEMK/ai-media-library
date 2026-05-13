import type { FolderDuplicateScanResultPayload } from "../../shared/ipc";

/**
 * Duplicate-files main pane: either waiting on a pipeline job or showing cached scan rows.
 */
export type DuplicateFilesSession =
  | {
      kind: "scanning";
      bundleId: string;
      /** Present when resolved from the pipeline queue after enqueue; used to match lifecycle events. */
      jobId: string | null;
      folderPath: string;
      recursive: boolean;
    }
  | {
      kind: "ready";
      payload: FolderDuplicateScanResultPayload;
    };
