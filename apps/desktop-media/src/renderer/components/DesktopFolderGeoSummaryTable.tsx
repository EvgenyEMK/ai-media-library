import type { ReactElement } from "react";
import type { FolderAiCoverageReport, FolderGeoMediaCoverage } from "../../shared/ipc";
import { cn } from "../lib/cn";
import {
  folderDisplayNameFromPath,
  formatCoveragePercent,
  formatGroupedInt,
  locationDetailsAsPipeline,
} from "../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../lib/ui-text";
import { PipelineStatusCell } from "./DesktopFolderAiPipelineStatusCell";

interface DesktopFolderGeoSummaryTableProps {
  selectedWithSubfolders: FolderAiCoverageReport;
  selectedDirectOnly: FolderAiCoverageReport;
  subfolders: Array<{ folderPath: string; name: string; coverage: FolderAiCoverageReport }>;
  onOpenFolderSummary?: (folderPath: string) => void;
}

const headerClass =
  "sticky top-[88px] z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]";

function GpsCoverageCell({ coverage }: { coverage: FolderGeoMediaCoverage }): ReactElement {
  if (coverage.total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-[190px] text-sm">
      <div className="mb-1 font-semibold text-muted-foreground">
        {formatCoveragePercent(coverage.withGpsCount, coverage.total)} ({formatGroupedInt(coverage.withGpsCount)})
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-muted-foreground"
          style={{ width: `${Math.min(100, (coverage.withGpsCount / coverage.total) * 100)}%` }}
        />
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
  coverage: FolderAiCoverageReport;
  highlighted?: boolean;
  noBottomBorder?: boolean;
  subfolderPath?: string;
  onSubfolderClick?: (folderPath: string) => void;
}): ReactElement {
  return (
    <tr className={highlighted ? "bg-primary/12" : undefined}>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top font-medium", noBottomBorder && "border-b-0", highlighted && "text-sm font-semibold")}>
        <FolderCell label={label} subfolderPath={subfolderPath} onSubfolderClick={onSubfolderClick} />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <PipelineStatusCell pipeline={locationDetailsAsPipeline(coverage.geo.locationDetails)} />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <GpsCoverageCell coverage={coverage.geo.images} />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <GpsCoverageCell coverage={coverage.geo.videos} />
      </td>
    </tr>
  );
}

export function DesktopFolderGeoSummaryTable({
  selectedWithSubfolders,
  selectedDirectOnly,
  subfolders,
  onOpenFolderSummary,
}: DesktopFolderGeoSummaryTableProps): ReactElement {
  const hasSubfolders = subfolders.length > 0;
  return (
    <div className="overflow-visible rounded-[10px] border border-border bg-card">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnFolder}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnLocationDetails}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnImagesGps}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnVideosGps}</th>
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
            <GeoRow label={folderDisplayNameFromPath(selectedDirectOnly.folderPath)} coverage={selectedDirectOnly} highlighted noBottomBorder />
          )}
        </tbody>
      </table>
    </div>
  );
}
