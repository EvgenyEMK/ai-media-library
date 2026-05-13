import type { FolderDuplicateScanResultPayload } from "../../src/shared/ipc";

const cache = new Map<string, FolderDuplicateScanResultPayload>();

export function storeFolderDuplicateScanResult(
  jobId: string,
  payload: FolderDuplicateScanResultPayload,
): void {
  cache.set(jobId, payload);
}

/** Returns and removes the cached payload so each job result is read at most once. */
export function takeFolderDuplicateScanResult(jobId: string): FolderDuplicateScanResultPayload | undefined {
  const payload = cache.get(jobId);
  if (payload !== undefined) {
    cache.delete(jobId);
  }
  return payload;
}
