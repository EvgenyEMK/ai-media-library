import type { ReactElement } from "react";
import { cn } from "../lib/cn";
import { UI_TEXT } from "../lib/ui-text";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";

type FollowUpLayout = "compact" | "panel";

interface DesktopMetadataScanFollowUpBarProps {
  layout: FollowUpLayout;
  pipeline: DesktopPipelineHandlers;
}

export function DesktopMetadataScanFollowUpBar({
  layout,
  pipeline,
}: DesktopMetadataScanFollowUpBarProps): ReactElement | null {
  const followUp = useDesktopStore((s) => s.metadataScanFollowUp);
  const storeApi = useDesktopStoreApi();

  if (!followUp) {
    return null;
  }

  const runPhoto = (): void => {
    const root = storeApi.getState().metadataScanFollowUp?.scanRootFolderPath;
    if (root) void pipeline.handleAnalyzePhotos(root, true, false);
  };

  const runFace = (): void => {
    const root = storeApi.getState().metadataScanFollowUp?.scanRootFolderPath;
    if (root) void pipeline.handleDetectFaces(root, true, false);
  };

  const runSemantic = (): void => {
    const root = storeApi.getState().metadataScanFollowUp?.scanRootFolderPath;
    if (root) void pipeline.handleIndexSemantic(root, true, false);
  };

  const btnClass =
    "rounded border border-amber-800/55 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-50 shadow-none hover:bg-amber-900/50";

  return (
    <div
      className={cn(
        "shrink-0 border-b border-amber-900/45 bg-gradient-to-r from-amber-950/50 to-amber-950/25",
        layout === "panel" ? "px-4 py-3" : "px-4 py-2",
      )}
      role="status"
    >
      <div
        className={cn(
          "flex gap-3",
          layout === "compact" ? "flex-row flex-wrap items-center justify-between" : "flex-col",
        )}
      >
        <p className={cn("text-xs text-amber-100/90", layout === "compact" ? "min-w-0 flex-1" : "")}>
          <strong className="font-semibold text-amber-200">
            {followUp.filesNeedingAiPipelineFollowUp}
          </strong>
          {` ${UI_TEXT.metadataScanFollowUpFilePhrase} `}
          <strong className="font-semibold text-amber-200">
            {followUp.foldersNeedingAiFollowUpCount}
          </strong>
          {` ${UI_TEXT.metadataScanFollowUpFolderPhrase} ${UI_TEXT.metadataScanFollowUpLineTail}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnClass} onClick={runSemantic}>
            {UI_TEXT.metadataScanFollowUpSemantic}
          </button>
          <button type="button" className={btnClass} onClick={runFace}>
            {UI_TEXT.metadataScanFollowUpFace}
          </button>
          <button type="button" className={btnClass} onClick={runPhoto}>
            {UI_TEXT.metadataScanFollowUpPhoto}
          </button>
        </div>
      </div>
    </div>
  );
}
