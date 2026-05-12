import { useMemo, useState, type ReactElement } from "react";
import type { LucideIcon } from "lucide-react";
import { Files, FolderOpen, HardDrive, Percent } from "lucide-react";
import type { DuplicateFolderSummary } from "../../lib/duplicate-files-folder-aggregate";
import { totalDuplicatePathsInSummaries } from "../../lib/duplicate-files-folder-aggregate";
import { cn } from "../../lib/cn";
import { formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { comparableFilePath } from "../../lib/media-metadata-lookup";
import {
  formatDuplicateShareInScanScopePercent,
  formatFolderTableDuplicateSize,
  formatStorageSizeForDuplicateMetricCards,
} from "../../lib/duplicate-files-metric-formatters";
import {
  DUPLICATE_FILES_TITLE_INSIDE_FLAT,
  DUPLICATE_FILES_TITLE_INSIDE_TREE,
  DUPLICATE_FILES_TITLE_OUTSIDE_FLAT,
  DUPLICATE_FILES_TITLE_OUTSIDE_TREE,
} from "../../lib/duplicate-files-ui-copy";
import { PendingSpinner } from "../folder-ai-summary/SummaryStatusPrimitives";

type FolderTableSortColumn = "duplicates" | "size";

/** Which duplicate-folder table the user picked a row from (outside vs. inside the scan tree on disk). */
export type DuplicateFolderPickRegion = "outside" | "inside";

function folderMediaCountLookup(
  folderPath: string,
  counts: Record<string, number>,
): number {
  const direct = counts[folderPath];
  if (typeof direct === "number") {
    return direct;
  }
  const key = comparableFilePath(folderPath).toLowerCase();
  for (const [k, v] of Object.entries(counts)) {
    if (comparableFilePath(k).toLowerCase() === key) {
      return v;
    }
  }
  return 0;
}

function DuplicateMetricCard({
  icon: Icon,
  label,
  primaryText,
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  primaryText: string;
  loading?: boolean;
}): ReactElement {
  return (
    <section className="flex min-h-[120px] min-w-[220px] flex-1 basis-[220px] items-center rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <Icon size={56} className="shrink-0 text-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="m-0 flex min-h-10 min-w-0 items-center text-3xl font-semibold leading-tight tracking-tight text-foreground">
            {loading ? <PendingSpinner className="h-8 w-8" aria-hidden="true" /> : <span className="truncate">{primaryText}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

function DuplicateFolderGroupTable({
  summaries,
  folderMediaCounts,
  region,
  onSelectFolder,
}: {
  summaries: DuplicateFolderSummary[];
  folderMediaCounts: Record<string, number>;
  region: DuplicateFolderPickRegion;
  onSelectFolder: (folderPath: string, region: DuplicateFolderPickRegion) => void;
}): ReactElement {
  const [sortColumn, setSortColumn] = useState<FolderTableSortColumn>("duplicates");

  const sortedSummaries = useMemo(() => {
    const copy = [...summaries];
    const tie = (a: DuplicateFolderSummary, b: DuplicateFolderSummary): number =>
      a.folderPath.localeCompare(b.folderPath);
    if (sortColumn === "duplicates") {
      copy.sort((a, b) => {
        const d = b.duplicatePathCount - a.duplicatePathCount;
        return d !== 0 ? d : tie(a, b);
      });
    } else {
      copy.sort((a, b) => {
        const d = b.duplicateBytesTotal - a.duplicateBytesTotal;
        return d !== 0 ? d : tie(a, b);
      });
    }
    return copy;
  }, [summaries, sortColumn]);

  const sortableHeaderClass = (active: boolean): string =>
    cn(
      "w-full rounded-sm px-1 py-0.5 text-center text-base font-medium transition-colors",
      active ? "cursor-pointer text-primary" : "cursor-pointer text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="min-w-0" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[7.5rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2.5 text-base font-medium text-foreground">Folder</th>
            <th
              className="px-2 py-2.5 text-center text-base font-medium text-muted-foreground"
              title="Share of catalog items in this folder (direct children only)"
            >
              % of folder
            </th>
            <th className="px-2 py-2.5">
              <button
                type="button"
                className={sortableHeaderClass(sortColumn === "duplicates")}
                aria-label="Sort by duplicate count, highest first"
                aria-sort={sortColumn === "duplicates" ? "descending" : undefined}
                onClick={() => setSortColumn("duplicates")}
              >
                Duplicates
              </button>
            </th>
            <th className="px-2 py-2.5">
              <button
                type="button"
                className={sortableHeaderClass(sortColumn === "size")}
                aria-label="Sort by total duplicate size in folder, largest first"
                aria-sort={sortColumn === "size" ? "descending" : undefined}
                onClick={() => setSortColumn("size")}
              >
                Size
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedSummaries.map((row) => {
            const totalInFolder = folderMediaCountLookup(row.folderPath, folderMediaCounts);
            const pctOfFolder =
              totalInFolder > 0 ? (Math.round((1000 * row.duplicatePathCount) / totalInFolder) / 10).toFixed(1) : null;
            return (
              <tr
                key={row.folderPath}
                className={cn(
                  "border-b border-border/80 transition-colors last:border-b-0",
                  "cursor-pointer hover:bg-muted/40",
                )}
                onClick={() => onSelectFolder(row.folderPath, region)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectFolder(row.folderPath, region);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <td className="min-w-0 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <FolderOpen size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="break-all font-mono text-base leading-snug text-foreground" title={row.folderPath}>
                      {row.folderPath}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-base tabular-nums text-muted-foreground">
                  {pctOfFolder !== null ? `${pctOfFolder}%` : "—"}
                </td>
                <td className="px-2 py-2.5 text-center text-base tabular-nums text-foreground">{row.duplicatePathCount}</td>
                <td className="px-2 py-2.5 text-center text-base tabular-nums text-muted-foreground">
                  {formatFolderTableDuplicateSize(row.duplicateBytesTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateFolderSection({
  sectionTitle,
  scopedFilesWithDupInScope,
  selectionScopeMediaCount,
  bytesTotal,
  summaries,
  folderMediaCounts,
  region,
  onSelectFolder,
}: {
  sectionTitle: string;
  scopedFilesWithDupInScope: number;
  selectionScopeMediaCount: number | null;
  bytesTotal: number;
  summaries: DuplicateFolderSummary[];
  folderMediaCounts: Record<string, number>;
  region: DuplicateFolderPickRegion;
  onSelectFolder: (folderPath: string, region: DuplicateFolderPickRegion) => void;
}): ReactElement {
  const dupPct = formatDuplicateShareInScanScopePercent(scopedFilesWithDupInScope, selectionScopeMediaCount);
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{sectionTitle}</h2>
      <div className="flex flex-wrap gap-3">
        <DuplicateMetricCard icon={Percent} label="Duplicates" primaryText={dupPct.primaryText} loading={dupPct.loading} />
        <DuplicateMetricCard icon={Files} label="Files" primaryText={formatGroupedInt(scopedFilesWithDupInScope)} />
        <DuplicateMetricCard icon={HardDrive} label="Size" primaryText={formatStorageSizeForDuplicateMetricCards(bytesTotal)} />
      </div>
      <DuplicateFolderGroupTable
        summaries={summaries}
        folderMediaCounts={folderMediaCounts}
        region={region}
        onSelectFolder={onSelectFolder}
      />
    </section>
  );
}

function DuplicateFolderSectionLoadingSkeleton({ sectionTitle }: { sectionTitle: string }): ReactElement {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{sectionTitle}</h2>
      <div className="flex flex-wrap gap-3">
        <DuplicateMetricCard icon={Percent} label="Duplicates" primaryText="" loading />
        <DuplicateMetricCard icon={Files} label="Files" primaryText="" loading />
        <DuplicateMetricCard icon={HardDrive} label="Size" primaryText="" loading />
      </div>
    </section>
  );
}

/**
 * Placeholder for the by-folder duplicate overview while the catalog scan pipeline runs.
 */
export function DuplicateFilesByFolderLoadingPanel(): ReactElement {
  return (
    <div className="space-y-10" aria-busy="true" aria-live="polite">
      <DuplicateFolderSectionLoadingSkeleton sectionTitle={DUPLICATE_FILES_TITLE_OUTSIDE_TREE} />
      <DuplicateFolderSectionLoadingSkeleton sectionTitle={DUPLICATE_FILES_TITLE_INSIDE_TREE} />
      <p className="text-sm text-muted-foreground">
        Results appear here when the scan finishes. Progress stays in Background operations.
      </p>
    </div>
  );
}

export function DuplicateFilesByFolderPanel({
  outsideSummaries,
  insideSummaries,
  folderMediaCounts,
  hasSelectionSubfolders,
  onSelectFolder,
  selectionScopeMediaCount,
  scopedWithDuplicateOutsideCount,
  outsideDuplicateBytesTotal,
  scopedWithDuplicateInsideCount,
  insideDuplicateBytesTotal,
}: {
  outsideSummaries: DuplicateFolderSummary[];
  insideSummaries: DuplicateFolderSummary[];
  folderMediaCounts: Record<string, number>;
  hasSelectionSubfolders: boolean;
  onSelectFolder: (folderPath: string, region: DuplicateFolderPickRegion) => void;
  selectionScopeMediaCount: number | null;
  scopedWithDuplicateOutsideCount: number;
  outsideDuplicateBytesTotal: number;
  scopedWithDuplicateInsideCount: number;
  insideDuplicateBytesTotal: number;
}): ReactElement {
  const titleOutside = hasSelectionSubfolders ? DUPLICATE_FILES_TITLE_OUTSIDE_TREE : DUPLICATE_FILES_TITLE_OUTSIDE_FLAT;
  const titleInside = hasSelectionSubfolders ? DUPLICATE_FILES_TITLE_INSIDE_TREE : DUPLICATE_FILES_TITLE_INSIDE_FLAT;

  const outsidePathTotal = totalDuplicatePathsInSummaries(outsideSummaries);
  const insidePathTotal = totalDuplicatePathsInSummaries(insideSummaries);
  const showInsideSectionFirst = insidePathTotal > outsidePathTotal;

  if (outsideSummaries.length === 0 && insideSummaries.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        No duplicate paths were found in the catalog column — nothing to group by folder.
      </p>
    );
  }

  const outsideSection =
    outsideSummaries.length > 0 ? (
      <DuplicateFolderSection
        sectionTitle={titleOutside}
        scopedFilesWithDupInScope={scopedWithDuplicateOutsideCount}
        selectionScopeMediaCount={selectionScopeMediaCount}
        bytesTotal={outsideDuplicateBytesTotal}
        summaries={outsideSummaries}
        folderMediaCounts={folderMediaCounts}
        region="outside"
        onSelectFolder={onSelectFolder}
      />
    ) : null;

  const insideSection =
    insideSummaries.length > 0 ? (
      <DuplicateFolderSection
        sectionTitle={titleInside}
        scopedFilesWithDupInScope={scopedWithDuplicateInsideCount}
        selectionScopeMediaCount={selectionScopeMediaCount}
        bytesTotal={insideDuplicateBytesTotal}
        summaries={insideSummaries}
        folderMediaCounts={folderMediaCounts}
        region="inside"
        onSelectFolder={onSelectFolder}
      />
    ) : null;

  return (
    <div className="space-y-10">
      {showInsideSectionFirst ? (
        <>
          {insideSection}
          {outsideSection}
        </>
      ) : (
        <>
          {outsideSection}
          {insideSection}
        </>
      )}

      <p className="text-sm text-muted-foreground">
        Click a folder row to switch to <strong className="text-foreground">By file</strong> filtered to files in that
        directory (scoped items or duplicate paths stored there).
      </p>
    </div>
  );
}
