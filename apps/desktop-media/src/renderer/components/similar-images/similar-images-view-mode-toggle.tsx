import { Grid3X3, List } from "lucide-react";
import type { ReactElement } from "react";
import { UI_TEXT } from "../../lib/ui-text";
import type { DesktopStoreState } from "../../stores/desktop-store";
import { ToolbarIconButton } from "../ToolbarIconButton";

export function SimilarImagesViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: DesktopStoreState["viewMode"];
  onViewModeChange: (mode: DesktopStoreState["viewMode"]) => void;
}): ReactElement {
  return (
    <div className="ml-auto flex items-center gap-2">
      <ToolbarIconButton
        title={UI_TEXT.gridView}
        ariaPressed={viewMode === "grid"}
        isActive={viewMode === "grid"}
        onClick={() => onViewModeChange("grid")}
      >
        <Grid3X3 size={16} aria-hidden="true" />
      </ToolbarIconButton>
      <ToolbarIconButton
        title={UI_TEXT.listView}
        ariaPressed={viewMode === "list"}
        isActive={viewMode === "list"}
        onClick={() => onViewModeChange("list")}
      >
        <List size={16} aria-hidden="true" />
      </ToolbarIconButton>
    </div>
  );
}
