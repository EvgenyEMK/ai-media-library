import type { ReactElement } from "react";
import type {
  FolderAiCoverageReport,
  FolderGeoMediaCoverage,
  FolderGeoPathLlmCoverage,
} from "../../shared/ipc";
import { cn } from "../lib/cn";
import {
  folderDisplayNameFromPath,
  formatCoveragePercent,
  formatGroupedInt,
  locationDetailsAsPipeline,
} from "../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../lib/ui-text";
import { CellSpinner } from "./desktop-folder-face-summary-table-cells";
import { PipelineStatusCell } from "./DesktopFolderAiPipelineStatusCell";
import { PendingSpinner } from "./folder-ai-summary/SummaryStatusPrimitives";

interface DesktopFolderGeoSummaryTableProps {
  /** Root folder path; used for single-folder layout label while coverage is loading. */
  folderPath: string;
  selectedWithSubfolders: FolderAiCoverageReport | undefined;
  selectedDirectOnly: FolderAiCoverageReport | undefined;
  subfolders: Array<{ folderPath: string; name: string; coverage: FolderAiCoverageReport | undefined }>;
  streamRowsIncomplete?: boolean;
  streamError?: string | null;
  onOpenFolderSummary?: (folderPath: string) => void;
}

const headerClass =
  "sticky z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040] [top:calc(var(--folder-ai-sticky-stack-offset,88px)_-_1px)]";

function CoverageBar({
  title,
  doneCount,
  total,
}: {
  title: string;
  doneCount: number;
  total: number;
}): ReactElement {
  if (total === 0) {
    return (
      <div>
        <div className="mb-1 font-semibold text-muted-foreground">{title} —</div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1 font-semibold text-muted-foreground">
        {title} {formatCoveragePercent(doneCount, total)} ({formatGroupedInt(doneCount)})
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(100, (doneCount / total) * 100)}%` }} />
      </div>
    </div>
  );
}

function FileGpsCoverageCell({
  images,
  videos,
}: {
  images: FolderGeoMediaCoverage;
  videos: FolderGeoMediaCoverage;
}): ReactElement {
  if (images.total + videos.total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-[220px] space-y-2 text-sm">
      <CoverageBar title="Images" doneCount={images.withGpsCount} total={images.total} />
      <CoverageBar title="Videos" doneCount={videos.withGpsCount} total={videos.total} />
    </div>
  );
}

function PathLlmCoverageCell({ detail }: { detail: FolderGeoPathLlmCoverage | undefined }): ReactElement {
  const totalImages = detail?.totalImages ?? 0;
  const doneCount = detail?.doneCount ?? 0;
  if (totalImages === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-[190px] text-sm">
      <div className="mb-1 font-semibold text-muted-foreground">
        {formatCoveragePercent(doneCount, totalImages)} ({formatGroupedInt(doneCount)})
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(100, (doneCount / totalImages) * 100)}%` }} />
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        Files with Country: {formatGroupedInt(detail?.filesWithCountry ?? 0)}, Area: {formatGroupedInt(detail?.filesWithArea ?? 0)}, City:{" "}
        {formatGroupedInt(detail?.filesWithCity ?? 0)}
      </div>
    </div>
  );
}

function FolderCell({
  label,
  subfolderPath,
  onSubfolderClick,
}: {
  label: string;
  subfolderPath?: string;
  onSubfolderClick?: (folderPath: string) => void;
}): ReactElement {
  if (!subfolderPath || !onSubfolderClick) return <>{label}</>;
  return (
    <button
      type="button"
      className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left font-inherit font-medium text-primary underline decoration-primary/45 underline-offset-2 shadow-none hover:decoration-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
      onClick={() => onSubfolderClick(subfolderPath)}
      title={UI_TEXT.folderAiAnalysisSummary}
      aria-label={`${UI_TEXT.folderAiAnalysisSummary}: ${label}`}
    >
      {label}
    </button>
  );
}

function GeoRow({
  label,
  coverage,
  highlighted = false,
  noBottomBorder = false,
  subfolderPath,
  onSubfolderClick,
}: {
  label: string;
  coverage: FolderAiCoverageReport | undefined;
  highlighted?: boolean;
  noBottomBorder?: boolean;
  subfolderPath?: string;
  onSubfolderClick?: (folderPath: string) => void;
}): ReactElement {
  if (!coverage) {
    return (
      <tr className={highlighted ? "bg-primary/12" : undefined}>
        <td className={cn("border-b border-border px-3 py-2.5 text-left align-top font-medium", noBottomBorder && "border-b-0", highlighted && "text-sm font-semibold")}>
          <FolderCell label={label} subfolderPath={subfolderPath} onSubfolderClick={onSubfolderClick} />
        </td>
        <td className={cn("border-b border-border px-3 py-2.5 align-top", noBottomBorder && "border-b-0")}>
          <CellSpinner />
        </td>
        <td className={cn("border-b border-border px-3 py-2.5 align-top", noBottomBorder && "border-b-0")}>
          <CellSpinner />
        </td>
        <td className={cn("border-b border-border px-3 py-2.5 align-top", noBottomBorder && "border-b-0")}>
          <CellSpinner />
        </td>
      </tr>
    );
  }

  return (
    <tr className={highlighted ? "bg-primary/12" : undefined}>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top font-medium", noBottomBorder && "border-b-0", highlighted && "text-sm font-semibold")}>
        <FolderCell label={label} subfolderPath={subfolderPath} onSubfolderClick={onSubfolderClick} />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <PipelineStatusCell pipeline={locationDetailsAsPipeline(coverage.geo.locationDetails)} />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <FileGpsCoverageCell images={coverage.geo.images} videos={coverage.geo.videos} />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <PathLlmCoverageCell detail={coverage.geo.pathLlmLocationDetails} />
      </td>
    </tr>
  );
}

export function DesktopFolderGeoSummaryTable({
  folderPath,
  selectedWithSubfolders,
  selectedDirectOnly,
  subfolders,
  streamRowsIncomplete = false,
  streamError = null,
  onOpenFolderSummary,
}: DesktopFolderGeoSummaryTableProps): ReactElement {
  const hasSubfolders = subfolders.length > 0;
  return (
    <div className="flex flex-col gap-3 pb-10">
      {streamError ? <p className="m-0 text-sm text-red-400">{streamError}</p> : null}
      {streamRowsIncomplete ? (
        <div
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <PendingSpinner className="h-4 w-4 shrink-0" />
          <span>{UI_TEXT.folderAiPipelineTableComputing}</span>
        </div>
      ) : null}

      <div className="overflow-visible rounded-[10px] border border-border bg-card">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnFolder}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnLocationDetails}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnFilesGps}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnPathLlmLocationDetails}</th>
          </tr>
        </thead>
        <tbody>
          {hasSubfolders ? (
            <>
              <GeoRow label={UI_TEXT.folderAiSummaryThisFolder} coverage={selectedWithSubfolders} highlighted />
              <GeoRow label={UI_TEXT.folderAiSummaryThisFolderDirectOnly} coverage={selectedDirectOnly} />
              <tr>
                <td className="h-6 border-0 border-x-0 border-y-0 bg-transparent p-0" colSpan={4} aria-hidden="true" />
              </tr>
              <tr>
                <td className="border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-foreground" colSpan={4}>
                  {UI_TEXT.folderAiSummarySubfolders}
                </td>
              </tr>
              {subfolders.map((row) => (
                <GeoRow
                  key={row.folderPath}
                  label={row.name}
                  coverage={row.coverage}
                  noBottomBorder={row.folderPath === subfolders[subfolders.length - 1]?.folderPath}
                  subfolderPath={row.folderPath}
                  onSubfolderClick={onOpenFolderSummary}
                />
              ))}
            </>
          ) : (
            <GeoRow
              label={folderDisplayNameFromPath(selectedDirectOnly?.folderPath ?? folderPath)}
              coverage={selectedDirectOnly}
              highlighted
              noBottomBorder
            />
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
