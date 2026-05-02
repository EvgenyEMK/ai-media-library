import type { ReactElement } from "react";
import type {
  FolderAiCoverageReport,
  FolderAiPipelineKind,
  FolderFaceSummary,
  FolderFaceSummaryStreamRowSpec,
} from "../../shared/ipc";
import {
  FOLDER_FACE_SUMMARY_STREAM_ROW_IDS,
  FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX,
} from "../../shared/ipc";
import { cn } from "../lib/cn";
import { folderDisplayNameFromPath, formatGroupedInt } from "../lib/folder-ai-summary-formatters";
import type { SummaryPipelineKind } from "../types/folder-ai-summary-types";
import { UI_TEXT } from "../lib/ui-text";
import {
  CellSpinner,
  FacesTaggedBody,
  PeoplePerImageBody,
  SuggestedMatchesBody,
  TableCellEmDash,
} from "./desktop-folder-face-summary-table-cells";
import { PipelineStatusCell } from "./DesktopFolderAiPipelineStatusCell";

function rowFolderLabel(spec: FolderFaceSummaryStreamRowSpec, rootFolderPath: string): string {
  if (spec.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive) {
    return UI_TEXT.folderAiSummaryThisFolder;
  }
  if (spec.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect) {
    return UI_TEXT.folderAiSummaryThisFolderDirectOnly;
  }
  if (spec.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder) {
    return folderDisplayNameFromPath(rootFolderPath);
  }
  return spec.name;
}

function FolderCell({
  label,
  subfolderPath,
  onOpenFolderSummary,
}: {
  label: string;
  subfolderPath?: string;
  onOpenFolderSummary?: (folderPath: string) => void;
}): ReactElement {
  if (subfolderPath && onOpenFolderSummary) {
    return (
      <button
        type="button"
        className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left font-inherit font-medium text-primary underline decoration-primary/45 underline-offset-2 shadow-none hover:decoration-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
        onClick={() => onOpenFolderSummary(subfolderPath)}
        title={UI_TEXT.folderAiAnalysisSummary}
        aria-label={`${UI_TEXT.folderAiAnalysisSummary}: ${label}`}
      >
        {label}
      </button>
    );
  }
  return <>{label}</>;
}

interface FaceSummaryRowProps {
  rootFolderPath: string;
  spec: FolderFaceSummaryStreamRowSpec;
  summary: FolderFaceSummary | undefined;
  coverage: FolderAiCoverageReport | undefined;
  highlighted?: boolean;
  noBottomBorder?: boolean;
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

export function FaceSummaryRow({
  rootFolderPath,
  spec,
  summary,
  coverage,
  highlighted = false,
  noBottomBorder = false,
  onOpenFolderSummary,
  onOpenFailedList,
  onRunPipeline,
  actionPendingPipeline,
}: FaceSummaryRowProps): ReactElement {
  const loading = summary === undefined || coverage === undefined;
  const zeroImages = !loading && coverage.totalImages === 0;
  const zeroFaces = !loading && !zeroImages && summary.detectedFaces === 0;
  const folderLabel = rowFolderLabel(spec, rootFolderPath);
  const subfolderPath = spec.rowId.startsWith(FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX)
    ? spec.folderPath
    : undefined;
  const showPipelineActions = spec.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect;

  const failedHandler =
    coverage && onOpenFailedList
      ? (): void => onOpenFailedList(coverage.folderPath, "face", coverage.recursive, folderLabel)
      : undefined;

  return (
    <tr className={highlighted ? "bg-primary/12" : undefined}>
      <td
        className={cn(
          "border-b border-border px-3 py-2.5 text-left align-top font-medium",
          noBottomBorder && "border-b-0",
          highlighted && "text-sm font-semibold",
        )}
      >
        <FolderCell label={folderLabel} subfolderPath={subfolderPath} onOpenFolderSummary={onOpenFolderSummary} />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        {loading ? (
          <CellSpinner />
        ) : (
          <span className="font-semibold text-foreground">{formatGroupedInt(coverage.totalImages)}</span>
        )}
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        {loading ? (
          <CellSpinner />
        ) : zeroImages ? (
          <TableCellEmDash />
        ) : (
          <PipelineStatusCell
            pipeline={coverage.face}
            actionPipeline={showPipelineActions ? "face" : undefined}
            onRunPipeline={onRunPipeline}
            actionPending={actionPendingPipeline === "face"}
            onOpenFailedList={coverage.face.failedCount > 0 ? failedHandler : undefined}
          />
        )}
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        {loading ? (
          <CellSpinner />
        ) : zeroImages ? (
          <TableCellEmDash />
        ) : (
          <FacesTaggedBody summary={summary} showTaggedSubline={summary.detectedFaces > 0} />
        )}
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        {loading ? (
          <CellSpinner />
        ) : zeroImages || zeroFaces ? (
          <TableCellEmDash />
        ) : (
          <SuggestedMatchesBody summary={summary} />
        )}
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        {loading ? (
          <CellSpinner />
        ) : zeroImages || zeroFaces ? (
          <TableCellEmDash />
        ) : (
          <PeoplePerImageBody summary={summary} />
        )}
      </td>
    </tr>
  );
}
