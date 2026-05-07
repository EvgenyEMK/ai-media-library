import type { ReactElement } from "react";
import type { FolderTreeQuickScanBreakdown, FolderTreeQuickScanSubfolderStats } from "../../shared/ipc";
import { folderDisplayNameFromPath, formatGroupedInt } from "../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../lib/ui-text";
import { QuickScanFolderStatusCell } from "./folder-ai-summary/QuickScanFolderStatusCell";

const headerClass =
  "sticky z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040] [top:calc(var(--folder-ai-sticky-stack-offset,88px)_-_1px)]";

function OptionalCountCell(props: {
  value: number;
  amber?: boolean;
  noBottomBorder?: boolean;
}): ReactElement {
  const { value, amber, noBottomBorder } = props;
  const tdClass = `border-b border-border px-3 py-2.5 align-top tabular-nums ${noBottomBorder ? "border-b-0" : ""}`;
  if (value === 0) {
    return <td className={tdClass} />;
  }
  return (
    <td className={`${tdClass} ${amber ? "text-amber-400" : ""}`}>{formatGroupedInt(value)}</td>
  );
}

function DataCells(props: {
  stats: FolderTreeQuickScanSubfolderStats;
  noBottomBorder?: boolean;
}): ReactElement {
  const { stats, noBottomBorder } = props;
  const pending = stats.newFileCount + stats.modifiedFileCount;
  return (
    <>
      <QuickScanFolderStatusCell
        foldersWithFolderScanRecord={stats.foldersWithFolderScanRecord}
        foldersWithDirectMediaOnDisk={stats.foldersWithDirectMediaOnDisk}
        pendingNewOrModified={pending}
        noBottomBorder={noBottomBorder}
      />
      <OptionalCountCell value={stats.newFileCount} amber noBottomBorder={noBottomBorder} />
      <OptionalCountCell value={stats.modifiedFileCount} amber noBottomBorder={noBottomBorder} />
      <OptionalCountCell value={stats.deletedFileCount} noBottomBorder={noBottomBorder} />
      <OptionalCountCell value={stats.movedFileCount} noBottomBorder={noBottomBorder} />
      <OptionalCountCell value={stats.foldersWithDirectMediaOnDisk} noBottomBorder={noBottomBorder} />
    </>
  );
}

interface DesktopFolderQuickScanSummaryTableProps {
  folderPath: string;
  breakdown: FolderTreeQuickScanBreakdown;
  hasSubfolders: boolean;
}

export function DesktopFolderQuickScanSummaryTable({
  folderPath,
  breakdown,
  hasSubfolders,
}: DesktopFolderQuickScanSummaryTableProps): ReactElement {
  return (
    <div className="flex flex-col gap-3 pb-10">
      <div className="overflow-visible rounded-[10px] border border-border bg-card">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnFolder}</th>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryQuickScanColScanStatus}</th>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryQuickScanColNew}</th>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryQuickScanColModified}</th>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryQuickScanColDeleted}</th>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryQuickScanColMoved}</th>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryQuickScanColMediaFolders}</th>
            </tr>
          </thead>
          <tbody>
            {hasSubfolders && breakdown.subfolders.length > 0 ? (
              <>
                <tr className="bg-primary/12">
                  <td className="border-b border-border px-3 py-2.5 text-left align-top text-sm font-semibold">
                    {UI_TEXT.folderAiSummaryThisFolder}
                  </td>
                  <DataCells stats={breakdown.selectedTree} />
                </tr>
                <tr>
                  <td className="border-b border-border px-3 py-2.5 text-left align-top font-medium">
                    {UI_TEXT.folderAiSummaryThisFolderDirectOnly}
                  </td>
                  <DataCells stats={breakdown.selectedDirectOnly} />
                </tr>
                <tr>
                  <td className="h-6 border-0 bg-transparent p-0" colSpan={7} aria-hidden="true" />
                </tr>
                <tr>
                  <td
                    className="border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-foreground"
                    colSpan={7}
                  >
                    {UI_TEXT.folderAiSummarySubfolders}
                  </td>
                </tr>
                {breakdown.subfolders.map((row, index) => (
                  <tr key={row.folderPath}>
                    <td
                      className={`border-b border-border px-3 py-2.5 text-left align-top font-medium ${
                        index === breakdown.subfolders.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      {row.name}
                    </td>
                    <DataCells
                      stats={row}
                      noBottomBorder={index === breakdown.subfolders.length - 1}
                    />
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td className="border-b border-border px-3 py-2.5 text-left align-top font-medium">{folderDisplayNameFromPath(folderPath)}</td>
                <DataCells stats={breakdown.selectedDirectOnly} noBottomBorder />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
