import { Check, CircleDashed, Loader2 } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { SummaryStatusTone } from "./summary-card-types";

export function PendingSpinner({ className }: { className?: string }): ReactElement {
  return <Loader2 className={cn("animate-spin text-muted-foreground", className)} aria-hidden="true" />;
}

export function SummaryCardStatusValue({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <span className={cn("text-2xl font-semibold leading-none", className)}>{children}</span>;
}

function statusToneClass(tone: SummaryStatusTone): string {
  if (tone === "green") return "text-success";
  if (tone === "amber") return "text-warning";
  if (tone === "red") return "text-destructive";
  return "text-muted-foreground";
}

/**
 * One renderer for the status icon + optional percent used inside summary cards.
 * Completed cards normally pass no `percentLabel`, so this renders a check only.
 */
export function SummaryCardStatusIndicator({
  tone,
  percentLabel,
  empty = false,
}: {
  tone: SummaryStatusTone;
  percentLabel?: string;
  empty?: boolean;
}): ReactElement {
  const toneClass = statusToneClass(tone);
  if (empty) {
    return <span className={cn("text-4xl font-semibold leading-none", toneClass)}>—</span>;
  }
  if (percentLabel != null) {
    return (
      <span className={cn("inline-flex items-center gap-2", toneClass)}>
        <CircleDashed size={28} aria-hidden="true" />
        <SummaryCardStatusValue>{percentLabel}</SummaryCardStatusValue>
      </span>
    );
  }
  if (tone === "green") {
    return <Check size={34} className={toneClass} aria-hidden="true" />;
  }
  return <CircleDashed size={28} className={toneClass} aria-hidden="true" />;
}
