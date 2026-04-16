import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Check, CircleDashed, ImageIcon, RefreshCw, Video } from "lucide-react";
import type { FolderAiCoverageReport } from "../../shared/ipc";
import { UI_TEXT } from "../lib/ui-text";

function formatPartialPercent(doneCount: number, totalImages: number): string {
  const raw = (doneCount / totalImages) * 100;
  const floored = Math.floor(raw);
  if (floored === 0 && raw > 0) {
    return `${raw.toFixed(1)}%`;
  }
  return `${floored}%`;
}

function PipelineStatusMini({ pipeline }: { pipeline: FolderAiCoverageReport["photo"] }): ReactElement {
  const total = pipeline.totalImages;
  if (total === 0) {
    return <span className="text-sm tracking-wide text-muted-foreground">—</span>;
  }
  const noPendingWork = total > 0 && pipeline.doneCount + pipeline.failedCount === total;

  if ((pipeline.label === "done" || (pipeline.label === "partial" && noPendingWork)) && total > 0) {
    return <Check size={16} aria-hidden="true" className="text-[hsl(var(--success))]" />;
  }
  if (pipeline.label === "partial" && total > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-foreground">
        <CircleDashed size={14} aria-hidden="true" className="opacity-[0.85]" />
        <span className="text-xs font-semibold">{formatPartialPercent(pipeline.doneCount, total)}</span>
      </span>
    );
  }
  return <span className="text-sm tracking-wide text-destructive">—</span>;
}

interface DesktopFolderAiPipelineStripProps {
  folderPath: string | null;
  imagesCount: number;
  videosCount: number;
  /** Bumps when jobs complete so the strip refetches coverage. */
  refreshKey: string;
}

export function DesktopFolderAiPipelineStrip({
  folderPath,
  imagesCount,
  videosCount,
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
          <span className="inline-flex h-12 items-center gap-1.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2.5 py-1.5 text-xs text-[#e8eefc]">
            <Video size={28} aria-hidden="true" className="opacity-85" />
            <span className="text-base font-semibold leading-none">{videosCount}</span>
          </span>
          <span className="inline-flex h-12 items-center gap-1.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2.5 py-1.5 text-xs text-[#e8eefc]">
            <ImageIcon size={28} aria-hidden="true" className="opacity-85" />
            <span className="text-base font-semibold leading-none">{imagesCount}</span>
          </span>
          {imagesCount > 0 ? (
            <>
              <span className="inline-flex h-12 flex-col items-center justify-center gap-0.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2 py-1 text-center" title={UI_TEXT.folderAiSummaryColumnSemantic}>
                <span className="text-[10px] uppercase tracking-wide opacity-75">{UI_TEXT.folderAiSummaryColumnSemantic}</span>
                <span className="text-xs text-[#e8eefc]"><PipelineStatusMini pipeline={coverage.semantic} /></span>
              </span>
              <span className="inline-flex h-12 flex-col items-center justify-center gap-0.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2 py-1 text-center" title={UI_TEXT.folderAiSummaryColumnFace}>
                <span className="text-[10px] uppercase tracking-wide opacity-75">{UI_TEXT.folderAiSummaryColumnFace}</span>
                <span className="text-xs text-[#e8eefc]"><PipelineStatusMini pipeline={coverage.face} /></span>
              </span>
              <span className="inline-flex h-12 flex-col items-center justify-center gap-0.5 rounded-md border border-[#2a3550] bg-[#151d2e] px-2 py-1 text-center" title={UI_TEXT.folderAiSummaryColumnPhoto}>
                <span className="text-[10px] uppercase tracking-wide opacity-75">{UI_TEXT.folderAiSummaryColumnPhoto}</span>
                <span className="text-xs text-[#e8eefc]"><PipelineStatusMini pipeline={coverage.photo} /></span>
              </span>
            </>
          ) : null}
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-secondary p-0 shadow-none"
            onClick={() => void load()}
            title={UI_TEXT.folderAiSummaryRefresh}
            aria-label={UI_TEXT.folderAiSummaryRefresh}
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : undefined} />
          </button>
        </div>
      ) : (
        <span className="opacity-[0.85]">{UI_TEXT.folderAiPipelineStripUnavailable}</span>
      )}
    </div>
  );
}
