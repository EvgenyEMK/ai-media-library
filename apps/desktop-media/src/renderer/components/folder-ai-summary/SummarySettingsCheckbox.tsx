import type { ReactElement } from "react";
import { useDesktopStore, useDesktopStoreApi } from "../../stores/desktop-store";

export function SummarySettingsCheckbox(): ReactElement {
  const checked = useDesktopStore((state) => state.folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder);
  const store = useDesktopStoreApi();
  return (
    <label className="flex max-w-fit items-center gap-2 rounded-md border border-border/70 bg-card/40 px-3 py-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        onChange={(event) =>
          store
            .getState()
            .updateFolderScanningSetting("showFolderAiSummaryWhenSelectingEmptyFolder", event.currentTarget.checked)
        }
      />
      <span>Automatically show this summary on empty folder selection</span>
    </label>
  );
}
