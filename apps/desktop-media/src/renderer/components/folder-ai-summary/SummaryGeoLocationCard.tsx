import { Info, MapPin, Play } from "lucide-react";
import type { ReactElement } from "react";
import type { FolderAiCoverageReport, FolderAiPipelineCounts, FolderGeoMediaCoverage } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { formatCoveragePercent, formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";
import { PendingSpinner, SummaryStatusGlyph } from "./SummaryStatusGlyph";
import type { FolderAiPipelineQueueStatus } from "../../lib/folder-ai-pipeline-queue-status";
import { SummaryMetricGrid } from "./SummaryMetricGrid";
import { statusTone, toneBorder, toneText } from "./summary-card-formatters";
import type { SummaryStatusTone } from "./summary-card-types";

function mediaCoveragePipeline(coverage: FolderGeoMediaCoverage): FolderAiPipelineCounts {
  const total = coverage.total;
  const done = coverage.locationDetailsDoneCount;
  let label: FolderAiPipelineCounts["label"] = "empty";
  if (total > 0) {
    if (done <= 0) label = "not_done";
    else if (done >= total) label = "done";
    else label = "partial";
  }
  return {
    totalImages: total,
    doneCount: done,
    failedCount: 0,
    label,
  };
}

function locationPipeline(coverage: FolderAiCoverageReport): FolderAiPipelineCounts {
  const total = coverage.geo.locationDetails.totalWithGps;
  const done = coverage.geo.locationDetails.doneCount;
  return mediaCoveragePipeline({
    total,
    locationDetailsDoneCount: done,
    withGpsCount: 0,
    withoutGpsCount: 0,
  });
}

function progressFillClass(tone: SummaryStatusTone | "neutralBar"): string {
  if (tone === "green") return "bg-success";
  if (tone === "amber") return "bg-warning";
  if (tone === "red") return "bg-destructive";
  return "bg-muted-foreground";
}

function ProgressBar({
  value,
  total,
  tone,
}: {
  value: number;
  total: number;
  tone: SummaryStatusTone | "neutralBar";
}): ReactElement {
  const ratio = total > 0 ? value / total : 0;
  return (
    <div className="mt-1 min-w-[220px] text-sm">
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", progressFillClass(tone))} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export function SummaryGeoLocationCard({
  coverage,
  loading = false,
  actionPending = false,
  queueStatus = null,
  onRunPipeline,
  onInfoClick,
}: {
  coverage: FolderAiCoverageReport;
  loading?: boolean;
  actionPending?: boolean;
  queueStatus?: FolderAiPipelineQueueStatus;
  onRunPipeline?: () => void;
  onInfoClick?: () => void;
}): ReactElement {
  const imageCoverage = coverage.geo.images;
  const videoCoverage = coverage.geo.videos;
  const totalMedia = imageCoverage.total + videoCoverage.total;
  const analyzedDone = coverage.geo.locationDetails.doneCount;
  const withGps = coverage.geo.locationDetails.totalWithGps;
  const analyzedPipeline = locationPipeline(coverage);
  const tone = loading ? "neutral" : withGps === 0 ? "neutral" : statusTone(analyzedPipeline);
  const hasGps = withGps > 0;
  const playTitle =
    queueStatus === "running"
      ? "Geo-location is running"
      : queueStatus === "queued"
        ? "Geo-location is waiting in queue"
        : "Run geo-location extraction";
  return (
    <section className={cn("min-w-[450px] flex-1 rounded-xl border bg-card p-4 shadow-sm", toneBorder(tone))}>
      <div className="grid grid-cols-[86px_minmax(0,1fr)_40px] grid-rows-[auto_auto] gap-x-4 gap-y-3">
        <div className="flex min-h-14 items-center justify-center">
          <MapPin size={56} className={toneText(tone)} aria-hidden="true" />
        </div>
        <h3 className="m-0 flex min-h-14 min-w-0 items-center text-[1.65rem] font-semibold leading-tight text-foreground">
          {UI_TEXT.folderAiSummaryGeoLocation}
        </h3>
        <div className="row-span-2 flex flex-col items-end justify-between gap-2">
          {onInfoClick ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 text-muted-foreground/80 shadow-none outline-none ring-0 transition-all duration-150 ease-out hover:scale-125 hover:text-foreground"
              title="About Geo-location"
              aria-label="About Geo-location"
              onClick={onInfoClick}
            >
              <Info size={25} aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" className="h-10 w-10" />
          )}
          <span aria-hidden="true" className="h-10 w-10" />
          {onRunPipeline ? (
            <button
              type="button"
              className={cn(
                "inline-flex h-10 w-10 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition-all duration-150 ease-out hover:scale-125 disabled:cursor-not-allowed disabled:opacity-50",
                tone === "amber"
                  ? "text-warning"
                  : tone === "red"
                    ? "text-destructive"
                    : "text-muted-foreground hover:text-foreground",
              )}
              title={playTitle}
              aria-label={playTitle}
              disabled={actionPending || queueStatus !== null}
              onClick={onRunPipeline}
            >
              <Play size={25} aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" className="h-10 w-10" />
          )}
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
          {loading ? <PendingSpinner className="h-8 w-8" /> : <SummaryStatusGlyph pipeline={analyzedPipeline} />}
          {!loading && tone === "amber" && analyzedDone > 0 ? (
            <span className="text-xs text-muted-foreground">{formatGroupedInt(analyzedDone)}</span>
          ) : null}
        </div>
        <div className="grid gap-2">
          {loading ? (
            <div aria-hidden="true" className="h-16" />
          ) : (
            <div className="rounded-lg bg-secondary/25 px-3 py-3">
              <div className="grid gap-2 text-sm text-muted-foreground">
                <div>
                  <SummaryMetricGrid
                    className="max-w-full"
                    items={[
                      {
                        label: "Files with GPS",
                        value: `${formatCoveragePercent(withGps, totalMedia)} (${formatGroupedInt(withGps)})`,
                        labelClassName: "font-medium",
                        valueClassName: "font-medium text-muted-foreground",
                      },
                    ]}
                  />
                  <ProgressBar value={withGps} total={Math.max(totalMedia, 1)} tone="neutralBar" />
                </div>
                {hasGps ? (
                  <div>
                    <SummaryMetricGrid
                      className="max-w-full"
                      items={[
                        {
                          label: "Location extracted",
                          value: tone === "green"
                            ? `${formatCoveragePercent(analyzedDone, withGps)} (${formatGroupedInt(analyzedDone)})`
                            : "",
                          labelClassName: "font-medium",
                          valueClassName: cn("font-medium", toneText(tone)),
                        },
                      ]}
                    />
                    <ProgressBar value={analyzedDone} total={Math.max(withGps, 1)} tone={tone} />
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
