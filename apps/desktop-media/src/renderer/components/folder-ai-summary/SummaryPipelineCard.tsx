import { Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { FolderAiPipelineCounts } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import type { SummaryPipelineKind } from "../../types/folder-ai-summary-types";
import { SummaryStatusGlyph, PendingSpinner } from "./SummaryStatusGlyph";
import { SummaryStatusLines } from "./SummaryStatusLines";
import { statusTone, toneBorder, toneText } from "./summary-card-formatters";
import type { SummaryStatusTone } from "./summary-card-types";

function PlayButton({
  title,
  tone,
  disabled,
  onClick,
}: {
  title: string;
  tone: SummaryStatusTone;
  disabled?: boolean;
  onClick: () => void;
}): ReactElement {
  const color =
    tone === "amber"
      ? "text-warning"
      : tone === "red"
        ? "text-destructive"
        : tone === "green"
          ? "text-border hover:text-success"
          : "text-border";
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent p-0 shadow-none hover:border-current disabled:cursor-not-allowed disabled:opacity-50",
        color,
      )}
      title="Run"
      aria-label={`Run ${title}`}
      disabled={disabled}
      onClick={onClick}
    >
      <Play size={16} aria-hidden="true" />
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
  onRunPipeline,
  completedLabel,
  issueLabel,
}: {
  icon: LucideIcon;
  title: string;
  pipeline: FolderAiPipelineCounts;
  actionPipeline?: SummaryPipelineKind;
  loading?: boolean;
  actionPending?: boolean;
  onRunPipeline?: (pipeline: SummaryPipelineKind) => void;
  completedLabel?: string;
  issueLabel?: string;
}): ReactElement {
  const tone = loading ? "neutral" : statusTone(pipeline);
  const titleClass = title.length > 18 ? "text-2xl" : "text-[1.65rem]";
  const detailsClass = cn(
    "flex justify-between gap-3 pl-2",
    tone === "green" ? "items-center" : "items-start",
  );
  return (
    <section className={cn("min-w-[375px] flex-1 rounded-xl border bg-primary/5 p-4 shadow-sm", toneBorder(tone))}>
      <div className="grid grid-cols-[86px_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-4 gap-y-3">
        <div className="flex justify-center">
          <Icon size={56} className={toneText(tone)} aria-hidden="true" />
        </div>
        <h3 className={cn("m-0 min-w-0 font-semibold leading-tight text-foreground", titleClass)}>{title}</h3>
        <div className="flex justify-center">
          {loading ? <PendingSpinner className="h-8 w-8" /> : <SummaryStatusGlyph pipeline={pipeline} />}
        </div>
        {loading ? (
          <div aria-hidden="true" />
        ) : (
          <div className={detailsClass}>
            <SummaryStatusLines pipeline={pipeline} completedLabel={completedLabel} issueLabel={issueLabel} />
            {actionPipeline && onRunPipeline ? (
              <PlayButton
                title={title}
                tone={tone}
                disabled={actionPending}
                onClick={() => onRunPipeline(actionPipeline)}
              />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
