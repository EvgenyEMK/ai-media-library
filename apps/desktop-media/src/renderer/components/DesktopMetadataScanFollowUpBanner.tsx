import type { ReactElement } from "react";
import { UI_TEXT } from "../lib/ui-text";

interface DesktopMetadataScanFollowUpBannerProps {
  scanRootFolderPath: string;
  filesNeedingAiPipelineFollowUp: number;
  foldersNeedingAiFollowUpCount: number;
  onRunPhotoMissing: () => void;
  onRunFaceMissing: () => void;
  onRunSemanticMissing: () => void;
  onDismiss: () => void;
}

export function DesktopMetadataScanFollowUpBanner({
  scanRootFolderPath,
  filesNeedingAiPipelineFollowUp,
  foldersNeedingAiFollowUpCount,
  onRunPhotoMissing,
  onRunFaceMissing,
  onRunSemanticMissing,
  onDismiss,
}: DesktopMetadataScanFollowUpBannerProps): ReactElement {
  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-900/50 bg-gradient-to-r from-[#2a2215] to-secondary px-4 py-2.5"
      role="status"
    >
      <div className="flex max-w-[640px] flex-col gap-1.5 text-[13px]">
        <strong className="text-amber-300">{UI_TEXT.metadataScanFollowUpTitle}</strong>
        <span>
          {filesNeedingAiPipelineFollowUp} file(s) may need AI pipelines (new catalog rows or catalog changes that
          cleared prior AI) across {foldersNeedingAiFollowUpCount} folder(s) under{" "}
          <code className="break-all text-[11px] opacity-90">{scanRootFolderPath}</code>. Run AI on items that are still
          missing results?
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="px-2.5 py-1.5 text-xs shadow-none" onClick={onRunPhotoMissing}>
          {UI_TEXT.metadataScanFollowUpPhoto}
        </button>
        <button type="button" className="px-2.5 py-1.5 text-xs shadow-none" onClick={onRunFaceMissing}>
          {UI_TEXT.metadataScanFollowUpFace}
        </button>
        <button type="button" className="px-2.5 py-1.5 text-xs shadow-none" onClick={onRunSemanticMissing}>
          {UI_TEXT.metadataScanFollowUpSemantic}
        </button>
        <button type="button" className="border-dashed px-2.5 py-1.5 text-xs opacity-[0.85] shadow-none" onClick={onDismiss}>
          {UI_TEXT.metadataScanFollowUpDismiss}
        </button>
      </div>
    </div>
  );
}
