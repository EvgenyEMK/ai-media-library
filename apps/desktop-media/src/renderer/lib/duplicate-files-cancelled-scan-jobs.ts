const cancelledDuplicateScanJobIds = new Set<string>();

export function markDuplicateScanJobCancelRequested(jobId: string | null | undefined): void {
  if (jobId) {
    cancelledDuplicateScanJobIds.add(jobId);
  }
}

export function consumeDuplicateScanJobCancelRequested(jobId: string): boolean {
  const found = cancelledDuplicateScanJobIds.has(jobId);
  if (found) {
    cancelledDuplicateScanJobIds.delete(jobId);
  }
  return found;
}

