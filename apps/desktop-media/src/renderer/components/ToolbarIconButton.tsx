import type { ReactElement } from "react";
import { cn } from "../lib/cn";

interface ToolbarIconButtonProps {
  title: string;
  dataTestId?: string;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  ariaPressed?: boolean;
  isActive?: boolean;
  badgeCount?: number;
  onClick: () => void;
  children: ReactElement;
}

export function ToolbarIconButton({
  title,
  dataTestId,
  ariaLabel,
  ariaExpanded,
  ariaPressed,
  isActive = false,
  badgeCount,
  onClick,
  children,
}: ToolbarIconButtonProps): ReactElement {
  return (
    <button
      type="button"
      title={title}
      {...(dataTestId ? { "data-testid": dataTestId } : {})}
      aria-label={ariaLabel ?? title}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border p-0 leading-none shadow-none",
        isActive ? "border-[#445484] bg-[#1f2740]" : "border-input bg-secondary",
      )}
      onClick={onClick}
    >
      {children}
      {typeof badgeCount === "number" && badgeCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-indigo-500 px-0.5 text-[10px] font-semibold leading-none text-white">
          {badgeCount}
        </span>
      ) : null}
    </button>
  );
}
