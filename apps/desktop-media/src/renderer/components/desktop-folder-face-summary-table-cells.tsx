import type { ReactElement } from "react";
import { User } from "lucide-react";
import type { FolderFaceSummary } from "../../shared/ipc";
import { cn } from "../lib/cn";
import { formatGroupedInt } from "../lib/folder-ai-summary-formatters";
import { summarizeMainSubjectsBuckets } from "../lib/main-subject-histogram-buckets";
import { UI_TEXT } from "../lib/ui-text";
import { PendingSpinner } from "./folder-ai-summary/SummaryStatusGlyph";

export function CellSpinner(): ReactElement {
  return (
    <div className="flex min-h-[2.5rem] items-center justify-start py-1">
      <PendingSpinner className="h-6 w-6" />
    </div>
  );
}

export function TableCellEmDash(): ReactElement {
  return <span className="text-muted-foreground">—</span>;
}

export function FacesTaggedBody({
  summary,
  showTaggedSubline,
}: {
  summary: FolderFaceSummary;
  showTaggedSubline: boolean;
}): ReactElement {
  return (
    <div className="space-y-0.5 text-left">
      <div className="font-semibold text-foreground">{formatGroupedInt(summary.detectedFaces)}</div>
      {showTaggedSubline ? (
        <div className="text-sm text-muted-foreground">{formatGroupedInt(summary.confirmedTaggedFaces)}</div>
      ) : null}
    </div>
  );
}

export function SuggestedMatchesBody({
  summary,
}: {
  summary: FolderFaceSummary;
}): ReactElement {
  return <span className="font-medium text-foreground">{formatGroupedInt(summary.suggestedUntaggedFaces)}</span>;
}

export function PeoplePerImageBody({
  summary,
}: {
  summary: FolderFaceSummary;
}): ReactElement {
  const buckets = summarizeMainSubjectsBuckets(summary.mainSubjectHistogram);
  const iconClass = "text-muted-foreground shrink-0";
  /** Fixed width so counts line up vertically within each column. */
  const iconTrackOneTwo = "inline-flex h-[1.125rem] w-10 shrink-0 items-center justify-start";
  const iconTrackThreeFour = "inline-flex h-[1.125rem] w-[3.75rem] shrink-0 items-center justify-start gap-0.5";
  const numClass = "min-w-0 font-medium tabular-nums text-foreground";

  return (
    <div className="grid grid-cols-2 gap-x-6 text-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={iconTrackOneTwo} aria-hidden="true">
            <User size={14} className={iconClass} />
          </span>
          <span className={numClass}>{formatGroupedInt(buckets.one)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={iconTrackOneTwo} aria-hidden="true">
            <User size={14} className={iconClass} />
            <User size={14} className={cn(iconClass, "-ml-1")} />
          </span>
          <span className={numClass}>{formatGroupedInt(buckets.two)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={cn(iconTrackThreeFour, "gap-0")} aria-hidden="true">
            <User size={14} className={iconClass} />
            <User size={14} className={cn(iconClass, "-ml-1")} />
            <User size={14} className={cn(iconClass, "-ml-1")} />
          </span>
          <span className={numClass}>{formatGroupedInt(buckets.threeExact)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={iconTrackThreeFour} aria-hidden="true">
            <span className="font-medium tabular-nums text-muted-foreground">
              {UI_TEXT.folderFaceTablePeoplePerImageFourPlusPrefix}
            </span>
            <User size={14} className={iconClass} />
          </span>
          <span className={numClass}>{formatGroupedInt(buckets.fourPlus)}</span>
        </div>
      </div>
    </div>
  );
}
