import { Eye, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { toneBorder, toneText } from "./summary-card-formatters";
import type { SummaryStatusTone } from "./summary-card-types";

const subtleActionButtonClass =
  "inline-flex h-10 w-10 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 text-muted-foreground/80 shadow-none outline-none ring-0 transition-all duration-150 ease-out hover:scale-125 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

export function SummaryActionCard({
  icon: Icon,
  title,
  tone,
  statusSlot,
  children,
  actionSlot,
  onInfoClick,
  onViewClick,
  viewTitle,
  titleClassName,
  iconClassName,
}: {
  icon: LucideIcon;
  title: string;
  tone: SummaryStatusTone;
  statusSlot: ReactNode;
  children: ReactNode;
  actionSlot?: ReactNode;
  onInfoClick?: () => void;
  onViewClick?: () => void;
  viewTitle?: string;
  titleClassName?: string;
  iconClassName?: string;
}): ReactElement {
  const hasActions = Boolean(onInfoClick || onViewClick || actionSlot);

  return (
    <section className={cn("min-w-[450px] flex-1 rounded-xl border bg-primary/5 p-4 shadow-sm", toneBorder(tone))}>
      <div
        className={cn(
          "grid grid-rows-[auto_auto] gap-x-4 gap-y-3",
          hasActions ? "grid-cols-[86px_minmax(0,1fr)_36px]" : "grid-cols-[86px_minmax(0,1fr)]",
        )}
      >
        <div className="flex items-center justify-center">
          <Icon size={56} className={cn(toneText(tone), iconClassName)} aria-hidden="true" />
        </div>
        <h3 className={cn("m-0 flex min-h-14 min-w-0 items-center font-semibold leading-tight text-foreground", titleClassName)}>
          {title}
        </h3>
        {hasActions ? (
          <div className="row-span-2 flex flex-col items-end justify-between gap-2">
            {onInfoClick ? (
              <button
                type="button"
                className={subtleActionButtonClass}
                title={`About ${title}`}
                aria-label={`About ${title}`}
                onClick={onInfoClick}
              >
                <Info size={25} aria-hidden="true" />
              </button>
            ) : (
              <span aria-hidden="true" className="h-10 w-10" />
            )}
            {onViewClick ? (
              <button
                type="button"
                className={subtleActionButtonClass}
                title={viewTitle ?? `View ${title} results`}
                aria-label={viewTitle ?? `View ${title} results`}
                onClick={onViewClick}
              >
                <Eye size={25} aria-hidden="true" />
              </button>
            ) : (
              <span aria-hidden="true" className="h-10 w-10" />
            )}
            {actionSlot ?? <span aria-hidden="true" className="h-10 w-10" />}
          </div>
        ) : null}
        <div className="flex flex-col items-center justify-center gap-1">{statusSlot}</div>
        <div className="flex min-h-10 items-center gap-3 pl-2">{children}</div>
      </div>
    </section>
  );
}
