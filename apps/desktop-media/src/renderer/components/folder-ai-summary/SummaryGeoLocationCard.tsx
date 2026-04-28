import { MapPin } from "lucide-react";
import type { ReactElement } from "react";
import type { FolderAiCoverageReport, FolderGeoMediaCoverage } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { formatCoveragePercent, formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";
import { SummaryStatusGlyph, PendingSpinner } from "./SummaryStatusGlyph";
import { combinedGeoTone, mediaLocationPipeline, toneBorder, toneText } from "./summary-card-formatters";

export const GPS_COVERAGE_WARNING_THRESHOLD = 0.75;

function GeoMediaRow({
  label,
  coverage,
  loading = false,
}: {
  label: string;
  coverage: FolderGeoMediaCoverage;
  loading?: boolean;
}): ReactElement {
  const pipeline = mediaLocationPipeline(coverage);
  const hasMedia = coverage.total > 0;
  const gpsCoverageRatio = hasMedia ? coverage.withGpsCount / coverage.total : 1;
  const gpsCoverageLow = gpsCoverageRatio < GPS_COVERAGE_WARNING_THRESHOLD;
  return (
    <div className="grid min-w-[220px] flex-1 grid-cols-[86px_minmax(0,1fr)] gap-x-4 rounded-lg bg-secondary/45 px-3 py-3">
      <div className="flex justify-center">
        {loading ? <PendingSpinner className="h-8 w-8" /> : <SummaryStatusGlyph pipeline={pipeline} />}
      </div>
      <div>
        <div className="text-xl font-medium text-foreground">{label}</div>
        {loading ? (
          <div aria-hidden="true" />
        ) : !hasMedia ? null : (
          <>
            <div className="grid gap-0.5 text-sm text-muted-foreground">
              <span>{formatGroupedInt(coverage.locationDetailsDoneCount)} completed</span>
            </div>
            <div className={cn("mt-1 text-sm text-muted-foreground", gpsCoverageLow ? "text-warning" : undefined)}>
              {UI_TEXT.folderAiSummaryGpsWith}: {formatCoveragePercent(coverage.withGpsCount, coverage.total)} (
              {formatGroupedInt(coverage.withGpsCount)}) of total
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SummaryGeoLocationCard({
  coverage,
  loading = false,
}: {
  coverage: FolderAiCoverageReport;
  loading?: boolean;
}): ReactElement {
  const imagePipeline = mediaLocationPipeline(coverage.geo.images);
  const videoPipeline = mediaLocationPipeline(coverage.geo.videos);
  const tone = loading ? "neutral" : combinedGeoTone(imagePipeline, videoPipeline);
  return (
    <section className={cn("min-w-[375px] flex-1 rounded-xl border bg-card p-4 shadow-sm", toneBorder(tone))}>
      <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-x-4">
        <div className="flex justify-center">
          <MapPin size={56} className={toneText(tone)} aria-hidden="true" />
        </div>
        <div>
          <h3 className="m-0 text-[1.65rem] font-semibold leading-tight text-foreground">
            {UI_TEXT.folderAiSummaryGeoLocation}
          </h3>
          <p className="m-0 text-sm text-muted-foreground">details extraction from GPS</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <GeoMediaRow label={UI_TEXT.folderAiSummaryColumnImages} coverage={coverage.geo.images} loading={loading} />
        <GeoMediaRow label={UI_TEXT.folderAiSummaryColumnVideos} coverage={coverage.geo.videos} loading={loading} />
      </div>
    </section>
  );
}
