import type { ReactElement, ReactNode } from "react";

interface ProgressCardBodyProps {
  title: ReactNode;
  action?: ReactNode;
  progressPercent: number;
  ariaLabel: string;
  statsText: string;
  rightText?: ReactNode;
  error?: string | null;
  showProgress?: boolean;
  secondaryBarPercent?: number | null;
  secondaryBarAriaLabel?: string;
  secondaryBarClassName?: string;
  footer?: ReactNode;
}

export function ProgressCardBody({
  title,
  action,
  progressPercent,
  ariaLabel,
  statsText,
  rightText,
  error,
  showProgress = true,
  secondaryBarPercent,
  secondaryBarAriaLabel,
  secondaryBarClassName,
  footer,
}: ProgressCardBodyProps): ReactElement {
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  const visiblePercent = clampedPercent > 0 && clampedPercent < 2 ? 2 : clampedPercent;
  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 flex min-w-0 flex-1 items-center gap-1.5 text-base">{title}</h2>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      {error ? (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {showProgress ? (
        <div className="mt-2 flex flex-col gap-2 overflow-auto">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label={ariaLabel}>
            <div
              className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
              style={{ width: `${visiblePercent}%` }}
            />
          </div>
          {secondaryBarPercent != null ? (
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]"
              aria-label={secondaryBarAriaLabel ?? "Secondary progress"}
            >
              <div
                className={secondaryBarClassName ?? "h-full bg-sky-400 transition-[width] duration-100 ease-linear"}
                style={{ width: `${Math.min(100, Math.max(0, secondaryBarPercent))}%` }}
              />
            </div>
          ) : null}
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>{statsText}</span>
              {rightText ? <span className="shrink-0">{rightText}</span> : null}
            </div>
            {footer}
          </div>
        </div>
      ) : null}
    </section>
  );
}
