import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn";
import { UI_TEXT } from "../../lib/ui-text";
import type { ReactElement } from "react";

interface ProgressDockHeaderProps {
  collapsed: boolean;
  onToggleCollapsed: (collapsed: boolean) => void;
}

export function ProgressDockHeader({
  collapsed,
  onToggleCollapsed,
}: ProgressDockHeaderProps): ReactElement {
  return (
    <div
      className={cn(
        "box-border flex min-h-7 shrink-0 items-center justify-center px-2.5 py-1",
        collapsed && "min-h-[22px] px-2 py-0.5",
      )}
    >
      <div className="flex items-center justify-center gap-2.5">
        <span className="select-none whitespace-nowrap text-[11px] font-semibold tracking-wide text-muted-foreground">
          {UI_TEXT.progressPanelTitle}
        </span>
        <button
          type="button"
          className="inline-flex h-[18px] w-11 min-w-11 shrink-0 items-center justify-center rounded border border-[#3d4a63] bg-[#1a2333] p-0 text-[#a8b8d8] shadow-none transition-colors hover:border-[#556380] hover:bg-[#232d42] hover:text-[#d4dff5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#79d7a4]"
          title={collapsed ? UI_TEXT.progressPanelExpand : UI_TEXT.progressPanelCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? UI_TEXT.progressPanelExpand : UI_TEXT.progressPanelCollapse}
          onClick={() => onToggleCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronUp size={14} aria-hidden="true" strokeWidth={2.25} />
          ) : (
            <ChevronDown size={14} aria-hidden="true" strokeWidth={2.25} />
          )}
        </button>
      </div>
    </div>
  );
}
