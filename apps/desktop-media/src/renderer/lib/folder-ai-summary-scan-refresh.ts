import { isPathWithinParent } from "./is-path-within-parent";

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
