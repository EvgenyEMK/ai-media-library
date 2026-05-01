import { Check, CircleDashed, Loader2, Play } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import type { FolderAiPipelineCounts } from "../../shared/ipc";
import {
  formatGroupedInt,
  formatPartialPercent,
  pipelineIsComplete,
} from "../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../lib/ui-text";
import type { SummaryPipelineKind } from "../types/folder-ai-summary-types";

interface FailedLineProps {
  failedCount: number;
  totalImages: number;
  onOpenFailedList?: () => void;
}

function FailedLine({ failedCount, totalImages, onOpenFailedList }: FailedLineProps): ReactElement | null {
  if (failedCount <= 0 || totalImages <= 0) return null;
  if (onOpenFailedList) {
    return (
      <button
        type="button"
        className="m-0 block cursor-pointer border-0 bg-transparent p-0 text-[11px] leading-snug text-destructive shadow-none"
        title={UI_TEXT.folderAiSummaryFailedListOpen}
        aria-label={`${UI_TEXT.folderAiSummaryFailedListOpen}: ${formatGroupedInt(failedCount)}`}
        onClick={onOpenFailedList}
      >
        {UI_TEXT.folderAiSummaryStatusFailed}: {formatGroupedInt(failedCount)}
      </button>
    );
  }
  return (
    <span className="block text-[11px] leading-snug text-destructive" title={UI_TEXT.folderAiSummaryStatusFailedCorrupt}>
      {UI_TEXT.folderAiSummaryStatusFailed}: {formatGroupedInt(failedCount)}
    </span>
  );
}

interface PipelineStatusCellProps {
  pipeline: FolderAiPipelineCounts;
  actionPipeline?: SummaryPipelineKind;
  onRunPipeline?: (pipeline: SummaryPipelineKind) => void;
  actionPending?: boolean;
  onOpenFailedList?: () => void;
  /** Shown after the status row (check / partial / not done) and before the failed line, if any */
  betweenStatusAndFailed?: ReactNode;
}

export function PipelineStatusCell({
  pipeline,
  actionPipeline,
  onRunPipeline,
  actionPending = false,
  onOpenFailedList,
  betweenStatusAndFailed,
}: PipelineStatusCellProps): ReactElement {
  const failedLine = (
    <FailedLine failedCount={pipeline.failedCount} totalImages={pipeline.totalImages} onOpenFailedList={onOpenFailedList} />
  );
  const total = pipeline.totalImages;
  const noPendingWork = pipelineIsComplete(pipeline);
  const canRunPipelineAction =
    Boolean(actionPipeline && onRunPipeline) &&
    total > 0 &&
    (pipeline.label === "partial" || pipeline.label === "not_done") &&
    !noPendingWork;
  const pipelineActionLabel =
    actionPipeline === "semantic"
      ? "Run AI search index for this folder and sub-folders"
      : actionPipeline === "face"
        ? "Run face detection for this folder and sub-folders"
        : actionPipeline === "photo"
          ? "Run AI image analysis for this folder and sub-folders"
          : actionPipeline === "rotation"
            ? "Analyze image rotation for this folder and sub-folders"
            : "Run pipeline for this folder and sub-folders";
  const actionButton = canRunPipelineAction ? (
    <button
      type="button"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-transparent p-0 text-muted-foreground shadow-none transition-colors duration-150 hover:border-indigo-500 hover:bg-[#1e2a40] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => onRunPipeline?.(actionPipeline as SummaryPipelineKind)}
      disabled={actionPending}
      title={pipelineActionLabel}
      aria-label={pipelineActionLabel}
    >
      {actionPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
    </button>
  ) : null;

  if ((pipeline.label === "done" || (pipeline.label === "partial" && noPendingWork)) && total > 0) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5 text-[hsl(var(--success))]" title={UI_TEXT.folderAiSummaryStatusDone}>
        <Check size={24} aria-hidden="true" />
        {betweenStatusAndFailed}
        {failedLine}
      </span>
    );
  }

  if (pipeline.label === "partial" && total > 0) {
    const percentLabel = formatPartialPercent(pipeline.doneCount, total);
    return (
      <span className="inline-flex flex-col items-start gap-0.5 text-foreground" title={UI_TEXT.folderAiSummaryStatusPartial}>
        <span className="inline-flex min-h-6 items-center gap-1.5 text-amber-400">
          <CircleDashed size={16} aria-hidden="true" className="shrink-0 opacity-[0.85]" />
          <span className="inline-flex items-baseline gap-[0.35em] whitespace-nowrap">
            <span className="text-base font-semibold leading-none">{percentLabel}</span>
            <span className="text-[11px] opacity-90">({formatGroupedInt(pipeline.doneCount)})</span>
          </span>
          {actionButton}
        </span>
        {betweenStatusAndFailed}
        {failedLine}
      </span>
    );
  }

  if (pipeline.label === "not_done" && pipeline.totalImages > 0) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5 text-[15px] tracking-wide text-destructive" title={UI_TEXT.folderAiSummaryStatusNotDone}>
        <span className="inline-flex min-h-6 items-center gap-1.5">
          <span>—</span>
          {actionButton}
        </span>
        {betweenStatusAndFailed}
        {failedLine}
      </span>
    );
  }

  return (
    <span className="text-[15px] tracking-wide text-muted-foreground" title={UI_TEXT.folderAiSummaryStatusNotDone}>
      —
    </span>
  );
}
