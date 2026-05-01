import { isPathWithinParent } from "./is-path-within-parent";
import type { AiPipelineCompletionSignal } from "../stores/desktop-slice";

export interface FolderSummaryScanCompletion {
  changed: boolean;
  folderPath: string;
  foldersTouched: string[];
}

export function shouldRefreshFolderAiSummaryAfterScan(
  visibleFolderPath: string,
  completion: FolderSummaryScanCompletion | null,
): boolean {
  if (!completion?.changed) return false;
  const affectedPaths = [completion.folderPath, ...completion.foldersTouched];
  return affectedPaths.some(
    (affectedPath) =>
      isPathWithinParent(affectedPath, visibleFolderPath) ||
      isPathWithinParent(visibleFolderPath, affectedPath),
  );
}

export function shouldRefreshFolderAiSummaryAfterPipeline(
  visibleFolderPath: string,
  completion: AiPipelineCompletionSignal | null,
): boolean {
  if (!completion) return false;
  return (
    isPathWithinParent(completion.folderPath, visibleFolderPath) ||
    isPathWithinParent(visibleFolderPath, completion.folderPath)
  );
}
