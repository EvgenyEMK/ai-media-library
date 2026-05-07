import { Check, CircleDashed } from "lucide-react";
import type { ReactElement } from "react";
import { formatCoveragePercent, formatPartialPercent } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";

function resolveAmberPercentLabel(done: number, total: number, pendingFiles: number): string {
  if (done < total) {
    const partial = formatPartialPercent(done, Math.max(total, 1));
    if (pendingFiles > 0 && partial === "100%") return "99%";
    return partial;
  }
  const pct = formatCoveragePercent(done, Math.max(total, 1));
  if (pendingFiles > 0 && pct === "100%") return "99%";
  return pct;
}

export function QuickScanFolderStatusCell({
  foldersWithFolderScanRecord: done,
  foldersWithDirectMediaOnDisk: total,
  pendingNewOrModified,
  noBottomBorder,
}: {
  foldersWithFolderScanRecord: number;
  foldersWithDirectMediaOnDisk: number;
  pendingNewOrModified: number;
  noBottomBorder?: boolean;
}): ReactElement {
  const tdClass = `border-b border-border px-3 py-2.5 align-top ${noBottomBorder ? "border-b-0" : ""}`;
  const pendingFiles = pendingNewOrModified;

  if (total <= 0) {
    return (
      <td className={`${tdClass} text-muted-foreground`} title={UI_TEXT.folderAiSummaryStatusNotDone}>
        —
      </td>
    );
  }

  if (done <= 0) {
    return (
      <td className={tdClass} title={UI_TEXT.folderAiSummaryStatusNotDone}>
        <span className="text-[15px] font-semibold tracking-wide text-destructive">0%</span>
      </td>
    );
  }

  if (done === total && pendingFiles === 0) {
    return (
      <td className={tdClass} title={UI_TEXT.folderAiSummaryStatusDone}>
        <span className="inline-flex text-[hsl(var(--success))]">
          <Check size={24} aria-hidden="true" />
        </span>
      </td>
    );
  }

  const label = resolveAmberPercentLabel(done, total, pendingFiles);

  return (
    <td className={tdClass} title={UI_TEXT.folderAiSummaryStatusPartial}>
      <span className="inline-flex min-h-6 items-center gap-1.5 text-amber-400">
        <CircleDashed size={16} aria-hidden="true" className="shrink-0 opacity-[0.85]" />
        <span className="text-base font-semibold leading-none">{label}</span>
      </span>
    </td>
  );
}
