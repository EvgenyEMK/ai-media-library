import { Loader2, Play } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { ScanFolderMetadataScope } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { UI_TEXT } from "../../lib/ui-text";

export function FolderTreeScanPlayMenu({
  ariaLabel,
  disabled,
  pending,
  playToneClass,
  onChoose,
}: {
  ariaLabel: string;
  disabled: boolean;
  pending: boolean;
  playToneClass: string;
  onChoose: (scope: ScanFolderMetadataScope) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent): void => {
      const el = wrapRef.current;
      if (el && !el.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return (): void => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative flex shrink-0" ref={wrapRef}>
      <button
        type="button"
        className={cn(
          "inline-flex h-10 w-10 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition-all duration-150 ease-out hover:scale-125 disabled:cursor-not-allowed disabled:opacity-50",
          playToneClass,
        )}
        title="Run folder scan"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        {pending ? (
          <Loader2 size={25} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={25} aria-hidden="true" />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={UI_TEXT.folderAiSummaryFolderScanMenuTitle}
          className="absolute right-0 top-full z-50 mt-1 min-w-[240px] rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {UI_TEXT.folderAiSummaryFolderScanMenuTitle}
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onChoose("incremental");
              setOpen(false);
            }}
          >
            {UI_TEXT.folderAiSummaryFolderScanOnlyChanges}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onChoose("full");
              setOpen(false);
            }}
          >
            {UI_TEXT.folderAiSummaryFolderScanFullTree}
          </button>
        </div>
      ) : null}
    </div>
  );
}
