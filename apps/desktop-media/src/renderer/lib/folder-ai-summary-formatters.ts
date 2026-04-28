import type { FolderAiPipelineCounts, FolderGeoLocationDetailsCoverage } from "../../shared/ipc";

/** Last path segment for display (Windows or POSIX). */
export function folderDisplayNameFromPath(folderPath: string): string {
  const trimmed = folderPath.replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]/);
  const last = parts[parts.length - 1]?.trim();
  return last || trimmed || folderPath;
}

/** Integer with space as thousands separator (e.g. 23 000). */
export function formatGroupedInt(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/\u202f|\u00a0/g, " ");
}

/** Partial %: integer when >=1%; one decimal when floored value is 0 but progress > 0. */
export function formatPartialPercent(doneCount: number, totalCount: number): string {
  if (totalCount <= 0) return "0%";
  const raw = (doneCount / totalCount) * 100;
  const floored = Math.floor(raw);
  if (floored === 0 && raw > 0) {
    return `${raw.toFixed(1)}%`;
  }
  return `${floored}%`;
}

export function formatCoveragePercent(doneCount: number, totalCount: number): string {
  if (totalCount <= 0) return "0%";
  return formatPartialPercent(doneCount, totalCount);
}

export function pipelineIsComplete(pipeline: FolderAiPipelineCounts): boolean {
  return pipeline.totalImages > 0 && pipeline.doneCount + pipeline.failedCount === pipeline.totalImages;
}

export function locationDetailsAsPipeline(
  details: FolderGeoLocationDetailsCoverage,
): FolderAiPipelineCounts {
  return {
    doneCount: details.doneCount,
    failedCount: 0,
    totalImages: details.totalWithGps,
    label: details.label,
  };
}
