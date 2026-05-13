import type { ReactElement, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Shared layout for folder context-menu rows: accordion label + trailing run/cancel control.
 * Matches the “Scan for file changes” row structure so Play/actions align across menu items.
 */
export function SidebarTreeFolderActionRow({
  accordionOpen,
  onToggleAccordion,
  label,
  runDisabled,
  runTitle,
  onRun,
  runControl,
  accordionContent,
}: {
  accordionOpen: boolean;
  onToggleAccordion: () => void;
  label: string;
  runDisabled?: boolean;
  runTitle: string;
  onRun: () => void;
  runControl: ReactNode;
  accordionContent?: ReactNode | null;
}): ReactElement {
  return (
    <>
      <div className="box-border flex min-h-[34px] w-full items-center justify-between gap-2 py-2 pl-2.5 pr-0 text-left text-sm leading-snug">
        <button
          type="button"
          className="inline-flex flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 px-0.5 text-left font-inherit text-inherit shadow-none"
          onClick={onToggleAccordion}
        >
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-150 ease-in-out",
              accordionOpen && "rotate-90",
            )}
            aria-hidden="true"
          />
          {label}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-1.5 py-1 text-muted-foreground shadow-none transition-colors duration-150 hover:border-indigo-500 hover:bg-[#1e2a40] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={runDisabled}
          title={runTitle}
          onClick={onRun}
        >
          {runControl}
        </button>
      </div>
      {accordionOpen && accordionContent ? accordionContent : null}
    </>
  );
}
