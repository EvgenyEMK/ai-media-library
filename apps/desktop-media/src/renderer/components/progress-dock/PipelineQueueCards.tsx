import { type ReactElement } from "react";
import { useDesktopStore } from "../../stores/desktop-store";
import { cn } from "../../lib/cn";
import type { BundleView, JobView } from "../../../shared/pipeline-types";

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

  if (running.length === 0 && queued.length === 0 && recent.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-1 rounded border border-border/50 bg-[#0c1320]/40 p-2"
      aria-label="Pipeline queue"
    >
      {running.length > 0 ? (
        <Section title="Running" tone="running">
          {running.map((bundle) => (
            <BundleCard key={bundle.bundleId} bundle={bundle} variant="running" />
          ))}
        </Section>
      ) : null}
      {queued.length > 0 ? (
        <Section title={`Queued (${queued.length})`} tone="queued">
          {queued.map((bundle) => (
            <BundleCard key={bundle.bundleId} bundle={bundle} variant="queued" />
          ))}
        </Section>
      ) : null}
      {recent.length > 0 ? (
        <Section title="Recently finished" tone="recent">
          {recent.slice(0, 3).map((bundle) => (
            <BundleCard key={bundle.bundleId} bundle={bundle} variant="recent" />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

interface SectionProps {
  title: string;
  tone: "running" | "queued" | "recent";
  children: ReactElement[];
}

function Section({ title, tone, children }: SectionProps): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <h3
        className={cn(
          "text-[11px] uppercase tracking-wide text-muted-foreground",
          tone === "running" && "text-emerald-300",
          tone === "queued" && "text-sky-300",
          tone === "recent" && "text-muted-foreground/80",
        )}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

interface BundleCardProps {
  bundle: BundleView;
  variant: "running" | "queued" | "recent";
}

function BundleCard({ bundle, variant }: BundleCardProps): ReactElement {
  const activeJob = bundle.jobs.find((j) => j.state === "running") ?? bundle.jobs[0];
  const completedCount = bundle.jobs.filter(
    (j) => j.state === "succeeded" || j.state === "failed" || j.state === "skipped",
  ).length;
  const total = bundle.jobs.length;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded border border-border/30 px-2 py-1.5",
        variant === "running" && "bg-emerald-500/5",
        variant === "queued" && "bg-sky-500/5",
        variant === "recent" && "bg-background/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-foreground">{bundle.displayName}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {variant === "queued"
            ? `${total} step${total === 1 ? "" : "s"}`
            : `${completedCount}/${total}`}
        </span>
      </div>
      {variant === "running" && activeJob ? <JobProgressLine job={activeJob} /> : null}
      {bundle.jobs.length > 1 ? <BundleBreadcrumb jobs={bundle.jobs} /> : null}
      {variant === "recent" ? (
        <span className="text-[10px] text-muted-foreground">{labelForBundleState(bundle.state)}</span>
      ) : null}
    </div>
  );
}

function JobProgressLine({ job }: { job: JobView }): ReactElement {
  const { progress } = job;
  const percent =
    progress.total != null && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">
          {progress.message ?? progress.phase ?? job.pipelineId}
        </span>
        <span className="shrink-0">
          {progress.total != null ? `${progress.processed}/${progress.total}` : "…"}
          {percent != null ? `  ${percent}%` : ""}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-border/50">
        <div
          className="h-full bg-emerald-400 transition-all"
          style={{ width: percent != null ? `${percent}%` : "10%" }}
        />
      </div>
    </div>
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
            job.state === "running" && "bg-emerald-500/20 text-emerald-200",
            job.state === "succeeded" && "bg-emerald-500/10 text-emerald-300/80",
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
