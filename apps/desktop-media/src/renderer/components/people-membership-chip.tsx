import { type ReactElement } from "react";
import { X } from "lucide-react";

/**
 * Pill chip with hover/focus remove control — shared by People table (groups on a person)
 * and People groups tab (people in a group).
 */
export function PeopleMembershipChip({
  label,
  onRemove,
  disabled = false,
  removeAriaLabel,
  removeTitle = "Remove",
}: {
  label: string;
  onRemove: () => void;
  disabled?: boolean;
  removeAriaLabel: string;
  removeTitle?: string;
}): ReactElement {
  return (
    <span className="group/personChip relative inline-block min-h-[22px] min-w-[5.5rem] max-w-[12rem] rounded-full border border-border bg-muted/40 py-0.5 text-xs transition-[padding] duration-150 ease-out pl-5 pr-5 max-sm:pl-3 max-sm:pr-7 sm:group-hover/personChip:pl-3 sm:group-hover/personChip:pr-7 sm:group-focus-within/personChip:pl-3 sm:group-focus-within/personChip:pr-7">
      <span className="block min-w-0 truncate text-left max-sm:text-left sm:text-center sm:group-hover/personChip:text-left sm:group-focus-within/personChip:text-left">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove()}
        className="absolute right-1 top-1/2 z-10 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/80 text-foreground shadow-sm transition-opacity duration-150 hover:bg-muted disabled:opacity-50 max-sm:pointer-events-auto max-sm:opacity-100 sm:pointer-events-none sm:opacity-0 sm:group-hover/personChip:pointer-events-auto sm:group-hover/personChip:opacity-100 sm:focus-visible:pointer-events-auto sm:focus-visible:opacity-100"
        aria-label={removeAriaLabel}
        title={removeTitle}
      >
        <X className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      </button>
    </span>
  );
}
