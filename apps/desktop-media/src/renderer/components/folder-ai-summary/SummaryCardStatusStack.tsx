import type { ReactElement, ReactNode } from "react";
import { PendingSpinner } from "./SummaryStatusPrimitives";

/**
 * Shared status column for `SummaryActionCard`: optional top row (icon + primary text),
 * optional second line (count / caption). Used by pipeline cards and Folder tree scan.
 */
export function SummaryCardStatusStack({
  loading,
  topRow,
  bottomRow,
}: {
  loading: boolean;
  topRow: ReactNode;
  bottomRow?: ReactNode;
}): ReactElement {
  if (loading) {
    return <PendingSpinner className="h-8 w-8" />;
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-2">{topRow}</div>
      {bottomRow != null ? (
        <div className="max-w-[220px] text-center text-xs leading-tight text-muted-foreground">{bottomRow}</div>
      ) : null}
    </div>
  );
}
