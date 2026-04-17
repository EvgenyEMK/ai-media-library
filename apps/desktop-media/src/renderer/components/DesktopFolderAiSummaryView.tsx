import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Check, CircleDashed, RefreshCw, X } from "lucide-react";
import type {
  FolderAiCoverageReport,
  FolderAiPipelineCounts,
  FolderAiSummaryReport,
} from "../../shared/ipc";
import { cn } from "../lib/cn";
import { UI_TEXT } from "../lib/ui-text";

/** Last path segment for display (Windows or POSIX). */
function folderDisplayNameFromPath(folderPath: string): string {
  const trimmed = folderPath.replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]/);
  const last = parts[parts.length - 1]?.trim();
  return last || trimmed || folderPath;
}

/** Integer with space as thousands separator (e.g. 23 000). */
function formatGroupedInt(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/\u202f|\u00a0/g, " ");
}

/** Partial %: integer when ≥1%; one decimal when floored value is 0 but progress > 0. */
function formatPartialPercent(doneCount: number, totalImages: number): string {
  const raw = (doneCount / totalImages) * 100;
  const floored = Math.floor(raw);
  if (floored === 0 && raw > 0) {
    return `${raw.toFixed(1)}%`;
  }
  return `${floored}%`;
}

interface DesktopFolderAiSummaryViewProps {
  folderPath: string;
  onBackToPhotos: () => void;
  /** Same as sidebar row menu "Folder AI analysis summary" for the given path. */
  onOpenFolderSummary?: (folderPath: string) => void;
}

function FailedLine({ failedCount, totalImages }: { failedCount: number; totalImages: number }): ReactElement | null {
  if (failedCount <= 0 || totalImages <= 0) return null;
  return (
    <span
      className="block text-[11px] leading-snug text-destructive"
      title={UI_TEXT.folderAiSummaryStatusFailedCorrupt}
    >
      {UI_TEXT.folderAiSummaryStatusFailed}: {formatGroupedInt(failedCount)}
    </span>
  );
}

function PipelineStatusCell({ pipeline }: { pipeline: FolderAiPipelineCounts }): ReactElement {
  const failedLine = <FailedLine failedCount={pipeline.failedCount} totalImages={pipeline.totalImages} />;
  const total = pipeline.totalImages;
  const noPendingWork =
    total > 0 && pipeline.doneCount + pipeline.failedCount === total;

  if ((pipeline.label === "done" || (pipeline.label === "partial" && noPendingWork)) && total > 0) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5 text-[hsl(var(--success))]" title={UI_TEXT.folderAiSummaryStatusDone}>
        <Check size={24} aria-hidden="true" />
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
        </span>
        {failedLine}
      </span>
    );
  }

  if (pipeline.label === "not_done" && pipeline.totalImages > 0) {
    return (
      <span className="text-[15px] tracking-wide text-destructive" title={UI_TEXT.folderAiSummaryStatusNotDone}>
        —
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

interface SummaryRowProps {
  label: string;
  coverage: FolderAiCoverageReport;
  highlighted?: boolean;
  /** When set with `onSubfolderClick`, the folder name is a control that opens that folder's summary. */
  subfolderPath?: string;
  onSubfolderClick?: (folderPath: string) => void;
}

function SummaryRow({
  label,
  coverage,
  highlighted = false,
  subfolderPath,
  onSubfolderClick,
}: SummaryRowProps): ReactElement {
  const folderCell =
    subfolderPath && onSubfolderClick ? (
      <button
        type="button"
        className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left font-inherit font-medium text-primary underline decoration-primary/45 underline-offset-2 shadow-none hover:decoration-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
        onClick={() => onSubfolderClick(subfolderPath)}
        title={UI_TEXT.folderAiAnalysisSummary}
        aria-label={`${UI_TEXT.folderAiAnalysisSummary}: ${label}`}
      >
        {label}
      </button>
    ) : (
      label
    );

  return (
    <tr className={highlighted ? "bg-primary/12" : undefined}>
      <td
        className={cn(
          "border-b border-border px-3 py-2.5 text-left align-top font-medium",
          highlighted && "text-sm font-semibold",
        )}
      >
        {folderCell}
      </td>
      <td className="border-b border-border px-3 py-2.5 text-left align-top">
        <span className="font-semibold text-foreground">{formatGroupedInt(coverage.totalImages)}</span>
      </td>
      <td className="border-b border-border px-3 py-2.5 text-left align-top">
        <PipelineStatusCell pipeline={coverage.semantic} />
      </td>
      <td className="border-b border-border px-3 py-2.5 text-left align-top">
        <PipelineStatusCell pipeline={coverage.face} />
      </td>
      <td className="border-b border-border px-3 py-2.5 text-left align-top">
        <PipelineStatusCell pipeline={coverage.photo} />
      </td>
    </tr>
  );
}

export function DesktopFolderAiSummaryView({
  folderPath,
  onBackToPhotos,
  onOpenFolderSummary,
}: DesktopFolderAiSummaryViewProps): ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWithSubfolders, setSelectedWithSubfolders] = useState<FolderAiCoverageReport | null>(null);
  const [selectedDirectOnly, setSelectedDirectOnly] = useState<FolderAiCoverageReport | null>(null);
  const [subfolders, setSubfolders] = useState<FolderAiSummaryReport["subfolders"]>([]);

  const load = useCallback(async () => {
    if (!folderPath) return;
    setLoading(true);
    setError(null);
    try {
      const report = await window.desktopApi.getFolderAiSummaryReport(folderPath);
      setSelectedWithSubfolders(report.selectedWithSubfolders);
      setSelectedDirectOnly(report.selectedDirectOnly);
      setSubfolders(report.subfolders);
    } catch {
      setError(UI_TEXT.folderAiSummaryError);
      setSelectedWithSubfolders(null);
      setSelectedDirectOnly(null);
      setSubfolders([]);
    } finally {
      setLoading(false);
    }
  }, [folderPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const iconBtnClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-secondary p-0 shadow-none";

  return (
    <div className="flex max-w-[960px] flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-lg">{UI_TEXT.folderAiSummaryTitle}</h2>
        <div className="inline-flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => void load()}
            disabled={loading}
            aria-label={UI_TEXT.folderAiSummaryRefresh}
            title={UI_TEXT.folderAiSummaryRefresh}
          >
            <RefreshCw size={18} aria-hidden="true" className={loading ? "animate-spin" : undefined} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            onClick={onBackToPhotos}
            aria-label={UI_TEXT.folderAiSummaryBack}
            title={UI_TEXT.folderAiSummaryBack}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.folderAiSummaryNote}</p>

      {loading ? <p className="m-0">{UI_TEXT.folderAiSummaryLoading}</p> : null}
      {error ? <p className="m-0 text-red-400">{error}</p> : null}

      {!loading && !error && selectedWithSubfolders && selectedDirectOnly ? (
        <div className="overflow-visible rounded-[10px] border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="sticky top-0 z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]">
                  {UI_TEXT.folderAiSummaryColumnFolder}
                </th>
                <th className="sticky top-0 z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]">
                  {UI_TEXT.folderAiSummaryColumnImages}
                </th>
                <th className="sticky top-0 z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]">
                  {UI_TEXT.folderAiSummaryColumnSemantic}
                </th>
                <th className="sticky top-0 z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]">
                  {UI_TEXT.folderAiSummaryColumnFace}
                </th>
                <th className="sticky top-0 z-[2] border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-foreground shadow-[0_1px_0_#2a3040]">
                  {UI_TEXT.folderAiSummaryColumnPhoto}
                </th>
              </tr>
            </thead>
            <tbody>
              {subfolders.length > 0 ? (
                <>
                  <SummaryRow
                    label={UI_TEXT.folderAiSummaryThisFolder}
                    coverage={selectedWithSubfolders}
                    highlighted
                  />
                  <SummaryRow label={UI_TEXT.folderAiSummaryThisFolderDirectOnly} coverage={selectedDirectOnly} />
                  <tr>
                    <td
                      className="border-b border-border bg-[#151d2e] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-foreground"
                      colSpan={5}
                    >
                      {UI_TEXT.folderAiSummarySubfolders}
                    </td>
                  </tr>
                  {subfolders.map((row) => (
                    <SummaryRow
                      key={row.folderPath}
                      label={row.name}
                      coverage={row.coverage}
                      subfolderPath={row.folderPath}
                      onSubfolderClick={onOpenFolderSummary}
                    />
                  ))}
                </>
              ) : (
                <SummaryRow
                  label={folderDisplayNameFromPath(folderPath)}
                  coverage={selectedDirectOnly}
                  highlighted
                />
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
