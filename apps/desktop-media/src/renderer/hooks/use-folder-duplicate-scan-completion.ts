import { useEffect } from "react";
import type { FolderDuplicateScanResultPayload } from "../../shared/ipc";
import { consumeDuplicateScanJobCancelRequested } from "../lib/duplicate-files-cancelled-scan-jobs";

/**
 * When a `folder-duplicate-scan` job finishes successfully, loads the cached result from main.
 */
export function useFolderDuplicateScanCompletion(
  onResult: (payload: FolderDuplicateScanResultPayload) => void,
): void {
  useEffect(() => {
    const api = window.desktopApi.pipelines;
    if (!api) return undefined;

    const off = api.onLifecycle((event) => {
      if (event.type !== "job-finished") return;
      if (event.pipelineId !== "folder-duplicate-scan") return;
      if (event.state !== "succeeded") return;

      if (consumeDuplicateScanJobCancelRequested(event.jobId)) {
        void window.desktopApi.getFolderDuplicateScanResult(event.jobId);
        return;
      }

      void window.desktopApi.getFolderDuplicateScanResult(event.jobId).then((res) => {
        if (res.ok) {
          onResult(res.result);
        }
      });
    });

    return off;
  }, [onResult]);
}
