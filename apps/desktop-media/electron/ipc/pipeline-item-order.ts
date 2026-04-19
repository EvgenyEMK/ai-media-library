export interface PipelineImageItem {
  path: string;
  name: string;
  folderPath: string;
}

export function orderPendingPipelineItems(
  items: PipelineImageItem[],
  failedPaths: Set<string>,
  skipPreviouslyFailed: boolean,
): PipelineImageItem[] {
  const pendingFresh: PipelineImageItem[] = [];
  const pendingFailed: PipelineImageItem[] = [];
  for (const item of items) {
    const isPreviouslyFailed = failedPaths.has(item.path);
    if (isPreviouslyFailed && skipPreviouslyFailed) {
      continue;
    }
    if (isPreviouslyFailed) {
      pendingFailed.push(item);
    } else {
      pendingFresh.push(item);
    }
  }
  return [...pendingFresh, ...pendingFailed];
}
