import type { ReactElement } from "react";
import { Eye } from "lucide-react";
import type { FolderAiCoverageReport, FolderAiPipelineKind } from "../../shared/ipc";
import { cn } from "../lib/cn";
import { folderDisplayNameFromPath, formatGroupedInt } from "../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../lib/ui-text";
import type { SummaryPipelineKind } from "../types/folder-ai-summary-types";
import { CellSpinner } from "./desktop-folder-face-summary-table-cells";
import { PipelineStatusCell } from "./DesktopFolderAiPipelineStatusCell";
import { PendingSpinner } from "./folder-ai-summary/SummaryStatusGlyph";

interface SummaryRowProps {
  label: string;
  coverage: FolderAiCoverageReport | undefined;
  highlighted?: boolean;
  noBottomBorder?: boolean;
  showPipelineActions?: boolean;
  onRunPipeline?: (pipeline: SummaryPipelineKind) => void;
  actionPendingPipeline?: SummaryPipelineKind | null;
  subfolderPath?: string;
  onSubfolderClick?: (folderPath: string) => void;
  onOpenFailedList?: (
    folderPath: string,
    pipeline: FolderAiPipelineKind,
    recursive: boolean,
    folderLabel: string,
  ) => void;
  onOpenWronglyRotatedImages?: (folderPath: string) => void;
}

function SummaryRow({
  label,
  coverage,
  highlighted = false,
  noBottomBorder = false,
  showPipelineActions = false,
  onRunPipeline,
  actionPendingPipeline,
  subfolderPath,
  onSubfolderClick,
  onOpenFailedList,
  onOpenWronglyRotatedImages,
}: SummaryRowProps): ReactElement {
  const folderCell =
    subfolderPath && onSubfolderClick ? (
      <button
        type="button"
        className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left font-inherit font-medium text-primary underline decoration-primary/45 underline-offset-2 shadow-none hover:decoration-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
        onClick={() => onSubfolderClick(subfolderPath)}
        title={UI_TEXT.folderAiAnalysisSummary}
        aria-label={`${UI_TEXT.folderAiAnalysisSummary}: ${label}`}
      >
        {label}
      </button>
    ) : (
      label
    );

  if (!coverage) {
    return (
      <tr className={highlighted ? "bg-primary/12" : undefined}>
        <td
          className={cn(
            "border-b border-border px-3 py-2.5 text-left align-top font-medium",
            noBottomBorder && "border-b-0",
            highlighted && "text-sm font-semibold",
          )}
        >
          {folderCell}
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
        <td className={cn("border-b border-border px-3 py-2.5 align-top", noBottomBorder && "border-b-0")}>
          <CellSpinner />
        </td>
        <td className={cn("border-b border-border px-3 py-2.5 align-top", noBottomBorder && "border-b-0")}>
          <CellSpinner />
        </td>
      </tr>
    );
  }

  const failedHandler = (pipeline: FolderAiPipelineKind): (() => void) | undefined =>
    onOpenFailedList
      ? () => onOpenFailedList(coverage.folderPath, pipeline, coverage.recursive, label)
      : undefined;

  const wronglyRotatedCount = coverage.rotation.issueCount ?? 0;

  return (
    <tr className={highlighted ? "bg-primary/12" : undefined}>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top font-medium", noBottomBorder && "border-b-0", highlighted && "text-sm font-semibold")}>
        {folderCell}
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <span className="font-semibold text-foreground">{formatGroupedInt(coverage.totalImages)}</span>
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <PipelineStatusCell
          pipeline={coverage.semantic}
          actionPipeline={showPipelineActions ? "semantic" : undefined}
          onRunPipeline={onRunPipeline}
          actionPending={actionPendingPipeline === "semantic"}
          onOpenFailedList={coverage.semantic.failedCount > 0 ? failedHandler("semantic") : undefined}
        />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <PipelineStatusCell
          pipeline={coverage.face}
          actionPipeline={showPipelineActions ? "face" : undefined}
          onRunPipeline={onRunPipeline}
          actionPending={actionPendingPipeline === "face"}
          onOpenFailedList={coverage.face.failedCount > 0 ? failedHandler("face") : undefined}
        />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <PipelineStatusCell
          pipeline={coverage.photo}
          actionPipeline={showPipelineActions ? "photo" : undefined}
          onRunPipeline={onRunPipeline}
          actionPending={actionPendingPipeline === "photo"}
          onOpenFailedList={coverage.photo.failedCount > 0 ? failedHandler("photo") : undefined}
        />
      </td>
      <td className={cn("border-b border-border px-3 py-2.5 text-left align-top", noBottomBorder && "border-b-0")}>
        <PipelineStatusCell
          pipeline={coverage.rotation}
          actionPipeline={showPipelineActions ? "rotation" : undefined}
          onRunPipeline={onRunPipeline}
          actionPending={actionPendingPipeline === "rotation"}
          betweenStatusAndFailed={
            wronglyRotatedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] leading-snug text-foreground">
                <span>
                  {UI_TEXT.folderAiSummaryWronglyRotatedCountPrefix}: {formatGroupedInt(wronglyRotatedCount)}
                </span>
                {onOpenWronglyRotatedImages ? (
                  <button
                    type="button"
                    className="m-0 inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-transparent p-0 text-muted-foreground shadow-none hover:text-foreground"
                    title={UI_TEXT.folderAiSummaryRotationReviewOpen}
                    aria-label={`${UI_TEXT.folderAiSummaryRotationReviewOpen}: ${label}`}
                    onClick={() => onOpenWronglyRotatedImages(coverage.folderPath)}
                  >
                    <Eye size={12} aria-hidden="true" />
                  </button>
                ) : null}
              </span>
            ) : null
          }
        />
      </td>
    </tr>
  );
}

interface DesktopFolderAiSummaryTableProps {
  folderPath: string;
  selectedWithSubfolders: FolderAiCoverageReport | undefined;
  selectedDirectOnly: FolderAiCoverageReport | undefined;
  subfolders: Array<{ folderPath: string; name: string; coverage: FolderAiCoverageReport | undefined }>;
  /** When true, shows a banner while coverage rows are still streaming in. */
  streamRowsIncomplete?: boolean;
  streamError?: string | null;
  onRunPipeline: (pipeline: SummaryPipelineKind) => void;
  actionPendingPipeline: SummaryPipelineKind | null;
  onOpenFolderSummary?: (folderPath: string) => void;
  onOpenFailedList: (
    folderPath: string,
    pipeline: FolderAiPipelineKind,
    recursive: boolean,
    folderLabel: string,
  ) => void;
  onOpenWronglyRotatedImages?: (folderPath: string) => void;
}

const headerClass =
  "sticky top-[88px] z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]";

export function DesktopFolderAiSummaryTable({
  folderPath,
  selectedWithSubfolders,
  selectedDirectOnly,
  subfolders,
  streamRowsIncomplete = false,
  streamError = null,
  onRunPipeline,
  actionPendingPipeline,
  onOpenFolderSummary,
  onOpenFailedList,
  onOpenWronglyRotatedImages,
}: DesktopFolderAiSummaryTableProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
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
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnImages}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnSemantic}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnFace}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnPhoto}</th>
            <th className={headerClass}>{UI_TEXT.folderAiSummaryColumnRotationAnalysis}</th>
          </tr>
        </thead>
        <tbody>
          {subfolders.length > 0 ? (
            <>
              <SummaryRow
                label={UI_TEXT.folderAiSummaryThisFolder}
                coverage={selectedWithSubfolders}
                highlighted
                onRunPipeline={onRunPipeline}
                actionPendingPipeline={actionPendingPipeline}
                onOpenFailedList={onOpenFailedList}
                onOpenWronglyRotatedImages={onOpenWronglyRotatedImages}
              />
              <SummaryRow
                label={UI_TEXT.folderAiSummaryThisFolderDirectOnly}
                coverage={selectedDirectOnly}
                showPipelineActions
                onRunPipeline={onRunPipeline}
                actionPendingPipeline={actionPendingPipeline}
                onOpenFailedList={onOpenFailedList}
                onOpenWronglyRotatedImages={onOpenWronglyRotatedImages}
              />
              <tr>
                <td className="h-6 border-0 border-x-0 border-y-0 bg-transparent p-0" colSpan={6} aria-hidden="true" />
              </tr>
              <tr>
                <td className="border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-foreground" colSpan={6}>
                  {UI_TEXT.folderAiSummarySubfolders}
                </td>
              </tr>
              {subfolders.map((row) => (
                <SummaryRow
                  key={row.folderPath}
                  label={row.name}
                  coverage={row.coverage}
                  noBottomBorder={row.folderPath === subfolders[subfolders.length - 1]?.folderPath}
                  subfolderPath={row.folderPath}
                  onSubfolderClick={onOpenFolderSummary}
                  onOpenFailedList={onOpenFailedList}
                  onOpenWronglyRotatedImages={onOpenWronglyRotatedImages}
                />
              ))}
            </>
          ) : (
            <SummaryRow
              label={folderDisplayNameFromPath(folderPath)}
              coverage={selectedDirectOnly}
              highlighted
              noBottomBorder
              onOpenFailedList={onOpenFailedList}
              onOpenWronglyRotatedImages={onOpenWronglyRotatedImages}
            />
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
