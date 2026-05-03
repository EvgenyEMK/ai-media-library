import type {
  FolderAiPipelineCounts,
  FolderAiSummaryOverview,
  FolderGeoMediaCoverage,
} from "../../../shared/ipc";
import { pipelineIsComplete } from "../../lib/folder-ai-summary-formatters";
import type { SummaryStatusTone } from "./summary-card-types";

export const pendingPipeline: FolderAiPipelineCounts = {
  doneCount: 0,
  failedCount: 0,
  totalImages: 0,
  label: "empty",
};

export const pendingGeoCoverage: FolderGeoMediaCoverage = {
  total: 0,
  withGpsCount: 0,
  withoutGpsCount: 0,
  locationDetailsDoneCount: 0,
};

export const pendingOverview: FolderAiSummaryOverview = {
  folderPath: "",
  recursive: true,
  totalImages: 0,
  totalVideos: 0,
  scanFreshness: {
    lastMetadataScanCompletedAt: null,
    oldestFolderScanCompletedAt: null,
    oldestMetadataExtractedAt: null,
    lastMetadataExtractedAt: null,
    scannedCount: 0,
    unscannedCount: 0,
    totalMedia: 0,
    folderTreeQuickScan: null,
  },
};

export function mediaLocationPipeline(coverage: FolderGeoMediaCoverage): FolderAiPipelineCounts {
  const label =
    coverage.withGpsCount === 0
      ? "empty"
      : coverage.locationDetailsDoneCount === 0
        ? "not_done"
        : coverage.locationDetailsDoneCount === coverage.withGpsCount
          ? "done"
          : "partial";
  return { doneCount: coverage.locationDetailsDoneCount, failedCount: 0, totalImages: coverage.withGpsCount, label };
}

export function statusTone(pipeline: FolderAiPipelineCounts): SummaryStatusTone {
  const complete = pipelineIsComplete(pipeline);
  if ((pipeline.label === "done" || (pipeline.label === "partial" && complete)) && pipeline.totalImages > 0) {
    return "green";
  }
  if (pipeline.label === "partial" && pipeline.totalImages > 0) return "amber";
  if (pipeline.label === "not_done" && pipeline.totalImages > 0) return "red";
  return "neutral";
}

export function toneText(tone: SummaryStatusTone): string {
  if (tone === "green") return "text-success";
  if (tone === "amber") return "text-warning";
  if (tone === "red") return "text-destructive";
  return "text-muted-foreground";
}

export function toneBorder(tone: SummaryStatusTone): string {
  if (tone === "green") return "border-success/70";
  if (tone === "amber") return "border-warning/70";
  if (tone === "red") return "border-destructive/70";
  return "border-border";
}

export function combinedGeoTone(
  image: FolderAiPipelineCounts,
  video: FolderAiPipelineCounts,
): SummaryStatusTone {
  const tones = [statusTone(image), statusTone(video)];
  if (tones.includes("red")) return "red";
  if (tones.includes("amber")) return "amber";
  if (tones.every((tone) => tone === "green" || tone === "neutral") && tones.includes("green")) return "green";
  return "neutral";
}

export function formatOldestScanLabel(oldestMetadataExtractedAt: string | null): string {
  if (!oldestMetadataExtractedAt) return "—";
  const date = new Date(oldestMetadataExtractedAt);
  if (Number.isNaN(date.getTime())) return oldestMetadataExtractedAt;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
