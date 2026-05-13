import { useEffect } from "react";
import { parseDuplicateMarkedFilesDeleteJobOutput } from "../lib/duplicate-files-delete-job-output";

/**
 * When a duplicate-file delete job finishes successfully, forwards deleted media ids.
 */
export function useDuplicateMarkedFilesDeleteCompletion(onDeletedMediaItemIds: (ids: readonly string[]) => void): void {
  useEffect(() => {
    const api = window.desktopApi.pipelines;
    if (!api) {
      return undefined;
    }
    const off = api.onLifecycle((event) => {
      if (event.type !== "job-finished") {
        return;
      }
      if (event.pipelineId !== "duplicate-marked-files-delete") {
        return;
      }
      if (event.state !== "succeeded") {
        return;
      }
      const parsed = parseDuplicateMarkedFilesDeleteJobOutput(event.output);
      if (!parsed || parsed.deletedMediaItemIds.length === 0) {
        return;
      }
      onDeletedMediaItemIds(parsed.deletedMediaItemIds);
    });
    return off;
  }, [onDeletedMediaItemIds]);
}
