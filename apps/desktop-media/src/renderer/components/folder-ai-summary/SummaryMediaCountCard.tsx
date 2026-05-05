import { ListChecks, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { DateDisplayFormat, FolderScanFreshness } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { formatCoveragePercent, formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";
import { SummaryActionCard } from "./SummaryActionCard";
import { SummaryCardStatusStack } from "./SummaryCardStatusStack";
import { SummaryMetricGrid, type SummaryMetricGridItem } from "./SummaryMetricGrid";
import { PendingSpinner, SummaryCardStatusIndicator } from "./SummaryStatusPrimitives";
import { formatOldestScanLabel } from "./summary-card-formatters";
import type { SummaryStatusTone } from "./summary-card-types";

export function SummaryMediaCountCard({
  icon: Icon,
  label,
  count,
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  loading?: boolean;
}): ReactElement {
  return (
    <section className="flex min-w-[450px] flex-1 items-center rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Icon size={80} className="shrink-0 text-foreground" aria-hidden="true" />
        <div>
          <p className="m-0 text-sm uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="m-0 flex min-h-10 items-center text-4xl font-semibold leading-tight text-foreground">
            {loading ? <PendingSpinner className="h-8 w-8" /> : formatGroupedInt(count)}
          </p>
        </div>
      </div>
    </section>
  );
}

export function LastDataScanCard({
  scanFreshness,
  dateFormat,
  loading = false,
  actionPending = false,
  outdatedAfterDays = 7,
  onRunFolderScan,
  onInfoClick,
}: {
  scanFreshness: FolderScanFreshness;
  dateFormat: DateDisplayFormat;
  loading?: boolean;
  actionPending?: boolean;
  outdatedAfterDays?: number;
  onRunFolderScan?: () => void;
  onInfoClick?: () => void;
}): ReactElement {
  const lastDataChange = formatOldestScanLabel(scanFreshness.lastMetadataExtractedAt, dateFormat);
  const title = UI_TEXT.folderAiSummaryFolderTreeScanTitle;
  const qs = scanFreshness.folderTreeQuickScan;
  const treeTotal = qs?.ultraFoldersScanned ?? 0;
  const treeNeed = qs?.treeFoldersWithDirectMediaOnDiskCount ?? 0;
  const treeCovered = qs?.treeFoldersWithMetadataFolderScanCount ?? 0;
  const foldersMissingFullScan = Math.max(treeNeed - treeCovered, 0);
  const addedChanged = qs != null ? qs.newFileCount + qs.modifiedFileCount : 0;
  const movedCount = qs?.movedFileCount ?? 0;

  const isRed =
    (qs != null && treeNeed > 0 && foldersMissingFullScan > 0) || addedChanged > 0;

  const fullTreeCoveredByFolderScan =
    qs != null && addedChanged === 0 && (treeNeed === 0 || foldersMissingFullScan === 0);

  const oldestScanMs = scanFreshness.oldestFolderScanCompletedAt
    ? new Date(scanFreshness.oldestFolderScanCompletedAt).getTime()
    : null;
  const isFullScanOutdated =
    fullTreeCoveredByFolderScan &&
    oldestScanMs != null &&
    Number.isFinite(oldestScanMs) &&
    Date.now() - oldestScanMs > outdatedAfterDays * 24 * 60 * 60 * 1000;

  const isAmber = !loading && !isRed && fullTreeCoveredByFolderScan && isFullScanOutdated;

  const scanTone: SummaryStatusTone = loading
    ? "neutral"
    : qs == null
      ? "neutral"
      : isRed
        ? "red"
        : isAmber
          ? "amber"
          : "green";

  const folderPercent =
    treeNeed === 0 ? "100%" : formatCoveragePercent(treeCovered, Math.max(treeNeed, 1));

  const statusCountLine =
    qs != null && treeNeed > 0
      ? (
          <span className="flex flex-col items-center">
            <span>{formatGroupedInt(treeCovered)}</span>
            <span>folders</span>
          </span>
        )
      : undefined;

  const playToneClass = loading
    ? "text-muted-foreground hover:text-foreground"
    : isRed
      ? "text-destructive hover:text-destructive"
      : isAmber
        ? "text-warning hover:text-warning"
        : "text-muted-foreground hover:text-foreground";

  const metricItems: SummaryMetricGridItem[] = [];
  if (!loading && foldersMissingFullScan > 0) {
    metricItems.push({
      label: "Folders missing full scan",
      value: formatGroupedInt(foldersMissingFullScan),
      valueClassName: "text-destructive",
    });
  }
  if (!loading && addedChanged > 0) {
    metricItems.push({
      label: "Files to add/update in database",
      value: formatGroupedInt(addedChanged),
      valueClassName: "text-destructive",
    });
  }
  if (!loading && movedCount > 0) {
    metricItems.push({
      label: "Moved files",
      value: formatGroupedInt(movedCount),
      valueClassName: "text-muted-foreground",
    });
  }
  if (!loading && qs != null && treeNeed > 0) {
    metricItems.push({
      label: "Folders analyzed (quick scan)",
      value: formatGroupedInt(treeNeed),
      valueClassName: "text-muted-foreground",
    });
  }
  if (!loading && isAmber && isFullScanOutdated) {
    metricItems.push({
      label: `Full scan older than ${formatGroupedInt(outdatedAfterDays)} days`,
      value: formatOldestScanLabel(scanFreshness.oldestFolderScanCompletedAt, dateFormat),
      valueClassName: "text-warning",
    });
  }
  metricItems.push({ label: "Last file change", value: lastDataChange });

  const actionSlot = onRunFolderScan ? (
    <button
      type="button"
      className={cn("inline-flex h-10 w-10 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition-all duration-150 ease-out hover:scale-125 disabled:cursor-not-allowed disabled:opacity-50", playToneClass)}
      title="Run folder scan"
      aria-label={`Run ${title}`}
      disabled={actionPending}
      onClick={onRunFolderScan}
    >
      <Play size={25} aria-hidden="true" />
    </button>
  ) : undefined;

  return (
    <SummaryActionCard
      icon={ListChecks}
      title={title}
      tone={scanTone}
      titleClassName="text-[1.65rem]"
      statusSlot={
        <SummaryCardStatusStack
          loading={loading}
          topRow={<SummaryCardStatusIndicator tone={scanTone} empty={qs == null} percentLabel={scanTone === "green" ? undefined : folderPercent} />}
          bottomRow={statusCountLine}
        />
      }
      actionSlot={actionSlot}
      onInfoClick={onInfoClick}
    >
      {loading ? null : <SummaryMetricGrid items={metricItems} />}
    </SummaryActionCard>
  );
}
