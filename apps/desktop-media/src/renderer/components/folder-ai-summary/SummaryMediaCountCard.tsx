import { ListChecks, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactElement } from "react";
import type { FolderScanFreshness } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";
import { PendingSpinner } from "./SummaryStatusGlyph";
import { formatOldestScanLabel } from "./summary-card-formatters";

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
    <section className="flex min-w-[220px] flex-1 items-center rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
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
}: {
  scanFreshness: FolderScanFreshness;
  hasSubfolders: boolean;
  loading?: boolean;
  actionPending?: boolean;
  outdatedAfterDays?: number;
  onRunFolderScan?: () => void;
}): ReactElement {
  const [showHelp, setShowHelp] = useState(false);
  const folderScan = formatOldestScanLabel(scanFreshness.oldestFolderScanCompletedAt);
  const lastDataChange = formatOldestScanLabel(scanFreshness.lastMetadataExtractedAt);
  const notScanned = scanFreshness.notFullyScannedDirectSubfolderCount;
  const title = hasSubfolders ? UI_TEXT.folderAiSummaryFolderTreeScanTitle : UI_TEXT.folderAiSummaryFolderScanTitle;
  const oldestScanMs = scanFreshness.oldestFolderScanCompletedAt
    ? new Date(scanFreshness.oldestFolderScanCompletedAt).getTime()
    : null;
  const isOutdated =
    oldestScanMs !== null &&
    Number.isFinite(oldestScanMs) &&
    Date.now() - oldestScanMs > outdatedAfterDays * 24 * 60 * 60 * 1000;
  const toneClass = notScanned > 0
    ? "border-destructive"
    : isOutdated
      ? "border-warning/70"
      : "border-border";
  const playToneClass = notScanned > 0
    ? "text-destructive hover:text-destructive"
    : isOutdated
      ? "text-warning hover:text-warning"
      : "text-border hover:text-success";
  return (
    <section className={cn("relative min-w-[300px] flex-1 rounded-xl border bg-card px-4 py-4 shadow-sm", toneClass)}>
      <div className="grid h-full grid-cols-[72px_minmax(0,1fr)] gap-x-4">
        <div className="flex h-full items-center justify-center">
          <ListChecks size={56} className="text-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="m-0 text-[1.65rem] font-semibold leading-tight text-foreground">{title}</h3>
            <button
              type="button"
              aria-label={`Show help for ${title}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-transparent p-0 text-sm text-muted-foreground shadow-none"
              onClick={() => setShowHelp((value) => !value)}
            >
              ?
            </button>
          </div>
          {showHelp ? (
            <div className="absolute left-4 right-4 top-16 z-10 rounded-lg border border-border bg-popover p-3 text-sm leading-5 text-popover-foreground shadow-lg">
              {UI_TEXT.folderAiSummaryFolderScanHelp}
            </div>
          ) : null}
          {loading ? (
            <div className="mt-3 flex min-h-10 items-center">
              <PendingSpinner className="h-8 w-8" />
            </div>
          ) : (
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="grid gap-1 text-sm text-muted-foreground">
                <span>Oldest scan: {folderScan}</span>
                {notScanned > 0 ? (
                  <span className="text-destructive">Not scanned: {formatGroupedInt(notScanned)}</span>
                ) : null}
                <span>Last data change: {lastDataChange}</span>
              </div>
              {onRunFolderScan ? (
                <button
                  type="button"
                  className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent p-0 shadow-none hover:border-current disabled:cursor-not-allowed disabled:opacity-50", playToneClass)}
                  title="Run folder scan"
                  aria-label={`Run ${title}`}
                  disabled={actionPending}
                  onClick={onRunFolderScan}
                >
                  <Play size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
