import { useEffect, useState, type ReactElement } from "react";
import { ConfirmActionDialog } from "../ConfirmActionDialog";
import { formatMbOrGbForDeleteConfirm } from "../../lib/duplicate-files-metric-formatters";

export function DuplicateFilesDeleteConfirmDialog({
  open,
  fileCount,
  folderCount,
  totalBytes,
  isBusy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  fileCount: number;
  folderCount: number;
  totalBytes: number;
  isBusy: boolean;
  onConfirm: (useTrash: boolean) => void;
  onCancel: () => void;
}): ReactElement | null {
  const [useTrash, setUseTrash] = useState(true);

  useEffect(() => {
    if (open) {
      setUseTrash(true);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const sizeLabel = formatMbOrGbForDeleteConfirm(totalBytes);

  return (
    <ConfirmActionDialog
      open={open}
      title="Delete files?"
      confirmLabel="Ok"
      cancelLabel="Cancel"
      isBusy={isBusy}
      emphasizeCancel
      tone="destructive"
      contentTextClassName="text-base leading-relaxed text-foreground"
      onConfirm={() => {
        onConfirm(useTrash);
      }}
      onCancel={onCancel}
    >
      <div className="space-y-3">
        <p>
          Delete {fileCount} file{fileCount === 1 ? "" : "s"} in {folderCount} folder
          {folderCount === 1 ? "" : "s"} ({sizeLabel})?
        </p>
        <p className="text-muted-foreground">This action cannot be undone.</p>
        <label className="flex cursor-pointer items-start gap-2.5 pt-0.5">
          <input
            type="checkbox"
            className="mt-1 size-[1.125rem] shrink-0 rounded border-border"
            checked={useTrash}
            onChange={(e) => {
              setUseTrash(e.target.checked);
            }}
          />
          <span className="leading-snug">Move deleted files to Recycle Bin or Trash</span>
        </label>
      </div>
    </ConfirmActionDialog>
  );
}
