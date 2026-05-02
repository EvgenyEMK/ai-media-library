import { Hourglass, Loader2, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { FolderAiPipelineCounts } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import type { SummaryPipelineKind } from "../../types/folder-ai-summary-types";
import { SummaryActionCard } from "./SummaryActionCard";
import type { SummaryMetricGridItem } from "./SummaryMetricGrid";
import { SummaryStatusGlyph, PendingSpinner } from "./SummaryStatusGlyph";
import { SummaryStatusLines } from "./SummaryStatusLines";
import { statusTone } from "./summary-card-formatters";
import type { SummaryStatusTone } from "./summary-card-types";
import type { FolderAiPipelineQueueStatus } from "../../lib/folder-ai-pipeline-queue-status";

function PlayButton({
  title,
  tone,
  disabled,
  queueStatus,
  onClick,
}: {
  title: string;
  tone: SummaryStatusTone;
  disabled?: boolean;
  queueStatus?: FolderAiPipelineQueueStatus;
  onClick: () => void;
}): ReactElement {
  const color =
    tone === "amber"
      ? "text-warning"
      : tone === "red"
        ? "text-destructive"
        : tone === "green"
          ? "text-muted-foreground hover:text-success"
          : "text-muted-foreground hover:text-foreground";
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 w-10 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition-transform duration-150 ease-out hover:scale-125 disabled:cursor-not-allowed disabled:opacity-50",
        color,
      )}
      title={queueStatus === "running" ? `${title} is running` : queueStatus === "queued" ? `${title} is waiting in queue` : "Run"}
      aria-label={queueStatus === "running" ? `${title} is running` : queueStatus === "queued" ? `${title} is waiting in queue` : `Run ${title}`}
      disabled={disabled}
      onClick={onClick}
    >
      {queueStatus === "running" ? (
        <Loader2 size={25} className="animate-spin" aria-hidden="true" />
      ) : queueStatus === "queued" ? (
        <Hourglass size={25} aria-hidden="true" />
      ) : (
        <Play size={25} aria-hidden="true" />
      )}
    </button>
  );
}

export function SummaryPipelineCard({
  icon: Icon,
  title,
  pipeline,
  actionPipeline,
  loading = false,
  actionPending = false,
  queueStatus = null,
  onRunPipeline,
  completedLabel,
  issueLabel,
  extraItems,
  onInfoClick,
  onViewClick,
  viewTitle,
}: {
  icon: LucideIcon;
  title: string;
  pipeline: FolderAiPipelineCounts;
  actionPipeline?: SummaryPipelineKind;
  loading?: boolean;
  actionPending?: boolean;
  queueStatus?: FolderAiPipelineQueueStatus;
  onRunPipeline?: (pipeline: SummaryPipelineKind) => void;
  completedLabel?: string;
  issueLabel?: string;
  extraItems?: SummaryMetricGridItem[];
  onInfoClick?: () => void;
  onViewClick?: () => void;
  viewTitle?: string;
}): ReactElement {
  const tone = loading ? "neutral" : statusTone(pipeline);
  const titleClass = title.length > 18 ? "text-2xl" : "text-[1.65rem]";
  const actionSlot = actionPipeline && onRunPipeline ? (
    <PlayButton
      title={title}
      tone={tone}
      disabled={actionPending || queueStatus !== null}
      queueStatus={actionPending ? "running" : queueStatus}
      onClick={() => onRunPipeline(actionPipeline)}
    />
  ) : undefined;
  return (
    <SummaryActionCard
      icon={Icon}
      title={title}
      tone={tone}
      titleClassName={titleClass}
      statusSlot={
        <>
          {loading ? <PendingSpinner className="h-8 w-8" /> : <SummaryStatusGlyph pipeline={pipeline} />}
          {!loading && tone === "amber" && pipeline.totalImages > 0 && pipeline.doneCount > 0 ? (
            <span className="text-xs text-muted-foreground">{formatGroupedInt(pipeline.doneCount)}</span>
          ) : null}
        </>
      }
      actionSlot={actionSlot}
      onInfoClick={onInfoClick}
      onViewClick={onViewClick}
      viewTitle={viewTitle}
    >
      {loading ? null : (
        <SummaryStatusLines
          pipeline={pipeline}
          completedLabel={completedLabel}
          issueLabel={issueLabel}
          tone={tone}
          extraItems={extraItems}
        />
      )}
    </SummaryActionCard>
  );
}
