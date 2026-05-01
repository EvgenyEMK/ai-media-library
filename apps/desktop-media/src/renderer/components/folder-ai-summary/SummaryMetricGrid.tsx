import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SummaryMetricGridItem {
  label: ReactNode;
  value: ReactNode;
  labelClassName?: string;
  valueClassName?: string;
}

export function SummaryMetricGrid({
  items,
  className,
}: {
  items: SummaryMetricGridItem[];
  className?: string;
}): ReactElement | null {
  const visibleItems = items.filter((item) => item.value !== null && item.value !== undefined);
  if (visibleItems.length === 0) return null;

  return (
    <div className={cn("inline-grid max-w-full grid-cols-[max-content_auto] items-baseline gap-x-3 gap-y-0.5 text-sm text-muted-foreground", className)}>
      {visibleItems.map((item, index) => (
        <div key={index} className="contents">
          <span className={cn("min-w-0 truncate text-muted-foreground", item.labelClassName)}>{item.label}</span>
          <span className={cn("whitespace-nowrap text-right tabular-nums", item.valueClassName)}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
