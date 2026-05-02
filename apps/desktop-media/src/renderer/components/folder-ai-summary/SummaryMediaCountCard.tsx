import { Check, CircleDashed, ListChecks, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { FolderScanFreshness } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { formatCoveragePercent, formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";
import { SummaryActionCard } from "./SummaryActionCard";
import { SummaryMetricGrid, type SummaryMetricGridItem } from "./SummaryMetricGrid";
import { PendingSpinner } from "./SummaryStatusGlyph";
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
  hasSubfolders,
  loading = false,
  actionPending = false,
  outdatedAfterDays = 7,
  onRunFolderScan,
  onInfoClick,
}: {
  scanFreshness: FolderScanFreshness;
  hasSubfolders: boolean;
  loading?: boolean;
  actionPending?: boolean;
  outdatedAfterDays?: number;
  onRunFolderScan?: () => void;
  onInfoClick?: () => void;
}): ReactElement {
  const lastDataChange = formatOldestScanLabel(scanFreshness.lastMetadataExtractedAt);
  const directSubfolders = scanFreshness.directSubfolderCount;
  const notScanned = scanFreshness.notFullyScannedDirectSubfolderCount;
  const outdatedScannedFolders = scanFreshness.outdatedScannedFolderCount;
  const scannedFolders = scanFreshness.scannedFolderCount;
  const title = hasSubfolders ? UI_TEXT.folderAiSummaryFolderTreeScanTitle : UI_TEXT.folderAiSummaryFolderScanTitle;
  const oldestScanMs = scanFreshness.oldestFolderScanCompletedAt
    ? new Date(scanFreshness.oldestFolderScanCompletedAt).getTime()
    : null;
  const isOutdated =
    oldestScanMs !== null &&
    Number.isFinite(oldestScanMs) &&
    Date.now() - oldestScanMs > outdatedAfterDays * 24 * 60 * 60 * 1000;
  const playToneClass = notScanned > 0
    ? "text-destructive hover:text-destructive"
    : isOutdated || outdatedScannedFolders > 0
      ? "text-warning hover:text-warning"
      : "text-muted-foreground hover:text-foreground";
  const scanTone: SummaryStatusTone = notScanned > 0 ? "red" : outdatedScannedFolders > 0 || isOutdated ? "amber" : "green";
  const scannedDirectSubfolders = Math.max(directSubfolders - notScanned, 0);
  const scanPercent =
    scanTone === "red"
      ? formatCoveragePercent(scannedDirectSubfolders, Math.max(directSubfolders, 1))
      : scanTone === "amber"
        ? formatCoveragePercent(outdatedScannedFolders, Math.max(scannedFolders, 1))
        : null;
  const outdatedPercent = scannedFolders > 0
    ? formatCoveragePercent(outdatedScannedFolders, scannedFolders)
    : "0%";
  const metricItems: SummaryMetricGridItem[] = [];
  if (notScanned > 0) {
    metricItems.push({
      label: "Not scanned direct subfolders",
      value: formatGroupedInt(notScanned),
      valueClassName: "text-destructive",
    });
  }
  if (outdatedScannedFolders > 0) {
    metricItems.push({
      label: `Outdated scan (>${formatGroupedInt(outdatedAfterDays)} days):`,
      value: `${formatGroupedInt(outdatedScannedFolders)} (${outdatedPercent})`,
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
        <>
          {loading ? (
            <PendingSpinner className="h-8 w-8" />
          ) : scanTone === "green" ? (
            <Check size={34} className="text-success" aria-hidden="true" />
          ) : (
            <span className={cn("inline-flex items-center gap-2", scanTone === "red" ? "text-destructive" : "text-warning")}>
              <CircleDashed size={28} aria-hidden="true" />
              <span className="text-2xl font-semibold leading-none">{scanPercent}</span>
            </span>
          )}
        </>
      }
      actionSlot={actionSlot}
      onInfoClick={onInfoClick}
    >
      {loading ? null : <SummaryMetricGrid items={metricItems} />}
    </SummaryActionCard>
  );
}
