import type { FolderAiCoverageReport, PhotoPendingFolderIconTint } from "../../shared/ipc";
import { photoPendingTintToBorderClass } from "./photo-pending-folder-tint";

/** Border for pipeline mini-cards: red (not done), amber (partial), default when done or no images. */
export function pipelineMiniCardBorderClass(pipeline: FolderAiCoverageReport["photo"]): string {
  const total = pipeline.totalImages;
  if (total <= 0) {
    return "border-[#2a3550]";
  }
  const noPendingWork = pipeline.doneCount + pipeline.failedCount === total;
  if ((pipeline.label === "done" || (pipeline.label === "partial" && noPendingWork)) && total > 0) {
    return "border-[#2a3550]";
  }
  if (pipeline.label === "partial") {
    return "border-amber-400";
  }
  if (pipeline.label === "not_done") {
    return "border-destructive";
  }
  return "border-[#2a3550]";
}

/**
 * Image analysis mini-card border: uses app setting tint when face + AI search are complete
 * but image analysis is not; otherwise same rules as {@link pipelineMiniCardBorderClass}.
 */
export function photoPipelineMiniCardBorderClass(
  coverage: FolderAiCoverageReport,
  photoPendingTint: PhotoPendingFolderIconTint,
): string {
  const pipeline = coverage.photo;
  const total = pipeline.totalImages;
  if (total <= 0) {
    return "border-[#2a3550]";
  }
  const noPendingWork = pipeline.doneCount + pipeline.failedCount === total;
  if ((pipeline.label === "done" || (pipeline.label === "partial" && noPendingWork)) && total > 0) {
    return "border-[#2a3550]";
  }
  if (
    coverage.face.label === "done" &&
    coverage.semantic.label === "done" &&
    pipeline.label !== "done"
  ) {
    return photoPendingTintToBorderClass(photoPendingTint);
  }
  return pipelineMiniCardBorderClass(pipeline);
}
