import { useCallback, type ReactElement } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/cn";
import { DuplicateFilesByFolderLoadingPanel } from "./duplicate-files-by-folder-panel";

export function DesktopDuplicateFilesScanningShell({
  folderPath,
  recursive,
  onClose,
}: {
  folderPath: string;
  recursive: boolean;
  onClose: () => void;
}): ReactElement {
  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/40"
          onClick={handleBack}
          aria-label="Exit duplicates view"
          title="Exit duplicates view"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight text-foreground">
            <span>Duplicates in folder</span>
            {recursive ? (
              <span className="ml-1.5 align-middle text-sm font-normal text-muted-foreground">(with subfolders)</span>
            ) : null}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={folderPath}>
            {folderPath}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            <button
              type="button"
              disabled
              className={cn(
                "rounded px-3 py-1.5 text-sm",
                "cursor-default bg-muted font-medium text-foreground",
              )}
            >
              By folder
            </button>
            <button
              type="button"
              className="cursor-not-allowed rounded px-3 py-1.5 text-sm text-muted-foreground opacity-50"
              disabled
              title="Available when the scan completes"
            >
              By file
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 pt-3 pb-14">
        <DuplicateFilesByFolderLoadingPanel />
      </div>
    </div>
  );
}
