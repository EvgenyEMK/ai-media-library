import { useCallback, useEffect, useState, type ReactElement } from "react";
import type { FolderAiCoverageReport, FolderAiPipelineLabel } from "../../shared/ipc";
import { UI_TEXT } from "../lib/ui-text";

function pipelineLabelText(label: FolderAiPipelineLabel): string {
  switch (label) {
    case "empty":
      return UI_TEXT.folderAiSummaryStatusEmpty;
    case "done":
      return UI_TEXT.folderAiSummaryStatusDone;
    case "not_done":
      return UI_TEXT.folderAiSummaryStatusNotDone;
    case "partial":
      return UI_TEXT.folderAiSummaryStatusPartial;
    default:
      return label;
  }
}

function formatCounts(c: FolderAiCoverageReport["photo"]): string {
  if (c.totalImages === 0) return "—";
  return `${c.doneCount}/${c.totalImages}`;
}

interface DesktopFolderAiPipelineStripProps {
  folderPath: string | null;
  /** Bumps when jobs complete so the strip refetches coverage. */
  refreshKey: string;
}

export function DesktopFolderAiPipelineStrip({
  folderPath,
  refreshKey,
}: DesktopFolderAiPipelineStripProps): ReactElement | null {
  const [coverage, setCoverage] = useState<FolderAiCoverageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const debugPhotoAi =
    typeof process !== "undefined" && process.env?.EMK_DEBUG_PHOTO_AI === "1";

  const load = useCallback(async () => {
    if (!folderPath) {
      setCoverage(null);
      return;
    }
    const t0 = Date.now();
    setLoading(true);
    try {
      if (debugPhotoAi) {
        console.log(
          `[folder-ai][renderer] getFolderAiCoverage START folder="${folderPath}" recursive=false`,
        );
      }
      const report = await window.desktopApi.getFolderAiCoverage(folderPath, false);
      setCoverage(report);
      if (debugPhotoAi) {
        console.log(
          `[folder-ai][renderer] getFolderAiCoverage OK folder="${folderPath}" total=${report.totalImages} durationMs=${Date.now() - t0}`,
        );
      }
    } catch (error) {
      setCoverage(null);
      if (debugPhotoAi) {
        console.log(
          `[folder-ai][renderer][error] getFolderAiCoverage FAILED folder="${folderPath}" durationMs=${Date.now() - t0} error="${error instanceof Error ? error.message : String(error)}"`,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [folderPath]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!folderPath) {
    return null;
  }

  return (
    <div className="text-xs text-[#9fb0d4]" aria-label={UI_TEXT.folderAiPipelineStripLabel}>
      {loading ? (
        <span className="opacity-[0.85]">{UI_TEXT.folderAiPipelineStripLoading}</span>
      ) : coverage ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex flex-col gap-0.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2 py-1" title={UI_TEXT.folderAiSummaryColumnFace}>
            <span className="text-[10px] uppercase tracking-wide opacity-75">{UI_TEXT.folderAiSummaryColumnFace}</span>
            <span className="text-xs text-[#e8eefc]">
              {pipelineLabelText(coverage.face.label)} ({formatCounts(coverage.face)})
            </span>
          </span>
          <span className="inline-flex flex-col gap-0.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2 py-1" title={UI_TEXT.folderAiSummaryColumnPhoto}>
            <span className="text-[10px] uppercase tracking-wide opacity-75">{UI_TEXT.folderAiSummaryColumnPhoto}</span>
            <span className="text-xs text-[#e8eefc]">
              {pipelineLabelText(coverage.photo.label)} ({formatCounts(coverage.photo)})
            </span>
          </span>
          <span className="inline-flex flex-col gap-0.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2 py-1" title={UI_TEXT.folderAiSummaryColumnSemantic}>
            <span className="text-[10px] uppercase tracking-wide opacity-75">{UI_TEXT.folderAiSummaryColumnSemantic}</span>
            <span className="text-xs text-[#e8eefc]">
              {pipelineLabelText(coverage.semantic.label)} ({formatCounts(coverage.semantic)})
            </span>
          </span>
          <button type="button" className="ml-1 px-2 py-1 text-[11px] shadow-none" onClick={() => void load()}>
            {UI_TEXT.folderAiSummaryRefresh}
          </button>
        </div>
      ) : (
        <span className="opacity-[0.85]">{UI_TEXT.folderAiPipelineStripUnavailable}</span>
      )}
    </div>
  );
}
