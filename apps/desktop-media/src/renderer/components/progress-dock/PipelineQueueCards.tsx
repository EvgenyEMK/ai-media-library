import { useState, type ReactElement } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useDesktopStore } from "../../stores/desktop-store";
import { cn } from "../../lib/cn";
import type { BundleView, JobView } from "../../../shared/pipeline-types";
import { ProgressDockCloseButton } from "./ProgressDockCloseButton";
import { ProgressCardBody } from "./cards/ProgressCardBody";
import { buildPipelineQueueRightText, buildPipelineQueueStatsText } from "../../lib/pipeline-queue-progress-stats";

/**
 * Renders the "central queue" view of the Background operations dock — the
 * single source of truth for bundles enqueued through the new
 * {@link PipelineScheduler}. Sits alongside the legacy per-feature cards
 * during the Phase 2-6 migration window; Phase 7 cleanup eventually replaces
 * the legacy cards entirely.
 *
 * The component is intentionally thin: it reads from `pipelineQueueSlice` and
 * renders a stack of `BundleCard`s grouped by lifecycle bucket. Each card
 * shows the bundle's display name, the active job's progress, and a
 * breadcrumb of remaining jobs.
 */
export function PipelineQueueCards(): ReactElement | null {
  const running = useDesktopStore((s) => s.pipelineRunning);
  const queued = useDesktopStore((s) => s.pipelineQueued);
  const recent = useDesktopStore((s) => s.pipelineRecent);
  const dismissRecentBundle = useDesktopStore((s) => s.dismissRecentBundle);
  const [recentExpanded, setRecentExpanded] = useState(false);

  if (running.length === 0 && queued.length === 0 && recent.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1" aria-label="Pipeline queue">
      {running.length > 0 ? (
        <div className="flex flex-col gap-1">
          {running.map((bundle) => (
            <BundleCard key={bundle.bundleId} bundle={bundle} variant="running" onDismissRecent={dismissRecentBundle} />
          ))}
        </div>
      ) : null}
      {queued.length > 0 ? (
        <Section title={`Queued (${queued.length})`}>
          {queued.map((bundle) => (
            <BundleCard key={bundle.bundleId} bundle={bundle} variant="queued" onDismissRecent={dismissRecentBundle} />
          ))}
        </Section>
      ) : null}
      {recent.length > 0 ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="m-0 inline-flex w-fit items-center gap-1 border-0 bg-transparent p-0 text-[11px] uppercase tracking-wide text-muted-foreground/80 shadow-none"
            aria-expanded={recentExpanded}
            onClick={() => setRecentExpanded((expanded) => !expanded)}
          >
            {recentExpanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
            <span>{`Completed (${recent.length})`}</span>
          </button>
          {recentExpanded ? (
            <div className="flex flex-col gap-1">
              {recent.slice(0, 3).map((bundle) => (
                <BundleCard key={bundle.bundleId} bundle={bundle} variant="recent" onDismissRecent={dismissRecentBundle} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SectionProps {
  title: string;
  children: ReactElement[];
}

function Section({ title, children }: SectionProps): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

interface BundleCardProps {
  bundle: BundleView;
  variant: "running" | "queued" | "recent";
  onDismissRecent: (bundleId: string) => void;
}

function BundleCard({ bundle, variant, onDismissRecent }: BundleCardProps): ReactElement {
  const activeJob = bundle.jobs.find((j) => j.state === "running") ?? bundle.jobs[0];
  const completedCount = bundle.jobs.filter(
    (j) => j.state === "succeeded" || j.state === "failed" || j.state === "skipped",
  ).length;
  const total = bundle.jobs.length;
  const title = variant === "running" && total > 1 ? `${completedCount + 1}/${total}: ${bundle.displayName}` : bundle.displayName;
  const action =
    variant === "running" ? (
      <ProgressDockCloseButton
        title={`Cancel ${bundle.displayName}`}
        ariaLabel={`Cancel ${bundle.displayName}`}
        onClick={() => {
          void window.desktopApi.pipelines.cancelBundle(bundle.bundleId);
        }}
      />
    ) : variant === "recent" && (bundle.state === "succeeded" || bundle.state === "cancelled") ? (
      <ProgressDockCloseButton
        title={`Dismiss ${bundle.displayName}`}
        ariaLabel={`Dismiss ${bundle.displayName}`}
        onClick={() => onDismissRecent(bundle.bundleId)}
      />
    ) : undefined;

  return (
    <ProgressCardBody
      title={title}
      action={action}
      progressPercent={activeJob && variant === "running" ? progressPercentForJob(activeJob, true) : variant === "recent" ? 100 : 0}
      ariaLabel={`${bundle.displayName} progress`}
      statsText={statsTextForBundle(bundle, variant, activeJob)}
      rightText={rightTextForBundle(variant, activeJob)}
      showProgress={variant !== "queued"}
      footer={bundle.jobs.length > 1 ? <BundleBreadcrumb jobs={bundle.jobs} /> : null}
    />
  );
}

function progressPercentForJob(job: JobView, minimumVisible: boolean): number {
  const { progress } = job;
  const percent =
    progress.total != null && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;
  if (!minimumVisible) return percent;
  if (percent > 0 && percent < 2) return 2;
  if (percent === 0 && job.state === "running") return 2;
  return percent;
}

function statsTextForBundle(bundle: BundleView, variant: BundleCardProps["variant"], activeJob: JobView | undefined): string {
  if (variant === "recent") {
    return labelForBundleState(bundle.state);
  }
  if (variant === "queued" || !activeJob) {
    return `${bundle.jobs.length} step${bundle.jobs.length === 1 ? "" : "s"}`;
  }
  return buildPipelineQueueStatsText(activeJob);
}

function rightTextForBundle(variant: BundleCardProps["variant"], activeJob: JobView | undefined): ReactElement | null {
  if (variant !== "running" || !activeJob) return null;
  const text = buildPipelineQueueRightText(activeJob);
  if (!text) return null;
  return <WarmupHint text={text} />;
}

function WarmupHint({ text }: { text: string }): ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

function BundleBreadcrumb({ jobs }: { jobs: JobView[] }): ReactElement {
  return (
    <div className="flex flex-wrap gap-1 text-[10px]">
      {jobs.map((job) => (
        <span
          key={job.jobId}
          className={cn(
            "rounded px-1 py-0.5",
            job.state === "running" && "bg-muted/30 text-foreground",
            job.state === "succeeded" && "bg-muted/30 text-muted-foreground",
            job.state === "failed" && "bg-red-500/20 text-red-200",
            job.state === "cancelled" && "bg-muted/40 text-muted-foreground line-through",
            job.state === "skipped" && "bg-muted/40 text-muted-foreground italic",
            job.state === "pending" && "bg-muted/30 text-muted-foreground",
          )}
        >
          {job.pipelineId}
        </span>
      ))}
    </div>
  );
}

function labelForBundleState(state: BundleView["state"]): string {
  switch (state) {
    case "succeeded":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "partial":
      return "Completed with errors";
    default:
      return state;
  }
}
