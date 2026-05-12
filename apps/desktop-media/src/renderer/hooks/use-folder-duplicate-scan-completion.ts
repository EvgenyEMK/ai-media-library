import { useEffect, useRef } from "react";
import type { JobState } from "../../shared/pipeline-types";
import type { FolderDuplicateScanResultPayload } from "../../shared/ipc";
import { consumeDuplicateScanJobCancelRequested } from "../lib/duplicate-files-cancelled-scan-jobs";

export interface FolderDuplicateScanLifecycleCallbacks {
  onSucceeded: (args: {
    jobId: string;
    bundleId: string;
    result: FolderDuplicateScanResultPayload;
  }) => void;
  /** Called when the job ends without applying a result (failure, scheduler cancel, or user cancel from the dock). */
  onEndedWithoutResult: (args: { jobId: string; bundleId: string; state: JobState }) => void;
}

/**
 * Listens for `folder-duplicate-scan` job completion: success loads cached result from main;
 * non-success clears any in-flight UI.
 */
export function useFolderDuplicateScanLifecycle(callbacks: FolderDuplicateScanLifecycleCallbacks): void {
  const onSucceededRef = useRef(callbacks.onSucceeded);
  const onEndedRef = useRef(callbacks.onEndedWithoutResult);
  onSucceededRef.current = callbacks.onSucceeded;
  onEndedRef.current = callbacks.onEndedWithoutResult;

  useEffect(() => {
    const api = window.desktopApi.pipelines;
    if (!api) return undefined;

    const off = api.onLifecycle((event) => {
      if (event.type !== "job-finished") return;
      if (event.pipelineId !== "folder-duplicate-scan") return;

      if (consumeDuplicateScanJobCancelRequested(event.jobId)) {
        void window.desktopApi.getFolderDuplicateScanResult(event.jobId);
        onEndedRef.current({ jobId: event.jobId, bundleId: event.bundleId, state: "cancelled" });
        return;
      }

      if (event.state === "succeeded") {
        void window.desktopApi.getFolderDuplicateScanResult(event.jobId).then((res) => {
          if (res.ok) {
            onSucceededRef.current({
              jobId: event.jobId,
              bundleId: event.bundleId,
              result: res.result,
            });
          } else {
            onEndedRef.current({ jobId: event.jobId, bundleId: event.bundleId, state: "failed" });
          }
        });
        return;
      }

      onEndedRef.current({ jobId: event.jobId, bundleId: event.bundleId, state: event.state });
    });

    return off;
  }, []);
}
