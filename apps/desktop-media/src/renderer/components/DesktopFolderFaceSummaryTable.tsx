import type { ReactElement } from "react";
import type {
  FolderAiCoverageReport,
  FolderAiPipelineKind,
  FolderFaceSummary,
  FolderFaceSummaryStreamRowSpec,
} from "../../shared/ipc";
import { FOLDER_FACE_SUMMARY_STREAM_ROW_IDS, FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX } from "../../shared/ipc";
import type { SummaryPipelineKind } from "../types/folder-ai-summary-types";
import { UI_TEXT } from "../lib/ui-text";
import { FaceSummaryRow } from "./desktop-folder-face-summary-table-row";
import { PendingSpinner } from "./folder-ai-summary/SummaryStatusGlyph";

const headerClass =
  "sticky top-[88px] z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]";

export interface DesktopFolderFaceSummaryTableProps {
  rootFolderPath: string;
  rowSpecs: FolderFaceSummaryStreamRowSpec[];
  summariesByRowId: Record<string, FolderFaceSummary>;
  coverageByRowId: Record<string, FolderAiCoverageReport>;
  allDone: boolean;
  streamError: string | null;
  onOpenFolderSummary?: (folderPath: string) => void;
  onOpenFailedList?: (
    folderPath: string,
    pipeline: FolderAiPipelineKind,
    recursive: boolean,
    folderLabel: string,
  ) => void;
  onRunPipeline?: (pipeline: SummaryPipelineKind) => void;
  actionPendingPipeline?: SummaryPipelineKind | null;
}

export function DesktopFolderFaceSummaryTable({
  rootFolderPath,
  rowSpecs,
  summariesByRowId,
  coverageByRowId,
  allDone,
  streamError,
  onOpenFolderSummary,
  onOpenFailedList,
  onRunPipeline,
  actionPendingPipeline,
}: DesktopFolderFaceSummaryTableProps): ReactElement {
  const singleFolderLayout =
    rowSpecs.length === 1 && rowSpecs[0]?.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder;
  const treeLayout = !singleFolderLayout && rowSpecs.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {streamError ? <p className="m-0 text-sm text-red-400">{streamError}</p> : null}
      {rowSpecs.length > 0 && !allDone ? (
        <div
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <PendingSpinner className="h-4 w-4 shrink-0" />
          <span>{UI_TEXT.folderFaceTableComputing}</span>
        </div>
      ) : null}

      <div className="overflow-visible rounded-[10px] border border-border bg-card">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnFolder}</th>
              <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnImages}</th>
              <th className={headerClass}>
                <div className="flex flex-col gap-0.5">
                  <span>{UI_TEXT.folderFaceTableColumnFaceDetectionLine1}</span>
                  <span className="text-xs font-normal tracking-normal text-muted-foreground">
                    {UI_TEXT.folderFaceTableColumnFaceDetectionLine2}
                  </span>
                </div>
              </th>
              <th className={headerClass}>
                <div className="flex flex-col gap-0.5">
                  <span title={UI_TEXT.folderFaceTableTaggedHelp}>{UI_TEXT.folderFaceTableColumnFacesTaggedLine1}</span>
                  <span className="text-xs font-normal tracking-normal text-muted-foreground">
                    {UI_TEXT.folderFaceTableColumnFacesTaggedLine2}
                  </span>
                </div>
              </th>
              <th className={headerClass}>{UI_TEXT.folderFaceTableColumnSuggestedMatches}</th>
              <th className={headerClass}>{UI_TEXT.folderFaceTableColumnPeoplePerImage}</th>
            </tr>
          </thead>
          <tbody>
            {singleFolderLayout && rowSpecs[0] ? (
              <FaceSummaryRow
                rootFolderPath={rootFolderPath}
                spec={rowSpecs[0]}
                summary={summariesByRowId[rowSpecs[0].rowId]}
                coverage={coverageByRowId[rowSpecs[0].rowId]}
                highlighted
                noBottomBorder
                onOpenFolderSummary={onOpenFolderSummary}
                onOpenFailedList={onOpenFailedList}
                onRunPipeline={onRunPipeline}
                actionPendingPipeline={actionPendingPipeline}
              />
            ) : null}

            {treeLayout ? (
              <>
                {rowSpecs
                  .filter((s) => s.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive)
                  .map((spec) => (
                    <FaceSummaryRow
                      key={spec.rowId}
                      rootFolderPath={rootFolderPath}
                      spec={spec}
                      summary={summariesByRowId[spec.rowId]}
                      coverage={coverageByRowId[spec.rowId]}
                      highlighted
                      onOpenFolderSummary={onOpenFolderSummary}
                      onOpenFailedList={onOpenFailedList}
                      onRunPipeline={onRunPipeline}
                      actionPendingPipeline={actionPendingPipeline}
                    />
                  ))}
                {rowSpecs
                  .filter((s) => s.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect)
                  .map((spec) => (
                    <FaceSummaryRow
                      key={spec.rowId}
                      rootFolderPath={rootFolderPath}
                      spec={spec}
                      summary={summariesByRowId[spec.rowId]}
                      coverage={coverageByRowId[spec.rowId]}
                      onOpenFolderSummary={onOpenFolderSummary}
                      onOpenFailedList={onOpenFailedList}
                      onRunPipeline={onRunPipeline}
                      actionPendingPipeline={actionPendingPipeline}
                    />
                  ))}
                <tr>
                  <td className="h-6 border-0 border-x-0 border-y-0 bg-transparent p-0" colSpan={6} aria-hidden="true" />
                </tr>
                <tr>
                  <td
                    className="border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-foreground"
                    colSpan={6}
                  >
                    {UI_TEXT.folderAiSummarySubfolders}
                  </td>
                </tr>
                {rowSpecs
                  .filter((s) => s.rowId.startsWith(FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX))
                  .map((spec, _index, arr) => (
                    <FaceSummaryRow
                      key={spec.rowId}
                      rootFolderPath={rootFolderPath}
                      spec={spec}
                      summary={summariesByRowId[spec.rowId]}
                      coverage={coverageByRowId[spec.rowId]}
                      noBottomBorder={spec.rowId === arr[arr.length - 1]?.rowId}
                      onOpenFolderSummary={onOpenFolderSummary}
                      onOpenFailedList={onOpenFailedList}
                      onRunPipeline={onRunPipeline}
                      actionPendingPipeline={actionPendingPipeline}
                    />
                  ))}
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
