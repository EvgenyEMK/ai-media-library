import { type ReactElement } from "react";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

const UI_TEXT = {
  confirm: "Delete",
  cancel: "Cancel",
} as const;

export function PeopleDeleteConfirmDialog({
  open,
  label,
  faceCount,
  mediaItemCount,
  isBusy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  label: string;
  faceCount: number;
  mediaItemCount: number;
  isBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement | null {
  if (!open) return null;

  return (
    <ConfirmActionDialog
      open={open}
      title={`Delete ${label} ?`}
      confirmLabel={UI_TEXT.confirm}
      cancelLabel={UI_TEXT.cancel}
      isBusy={isBusy}
      emphasizeCancel
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="space-y-2">
        <p>
          This removes the person and all linked face and media tags. You cannot undo this action.
        </p>
        <p className="flex flex-wrap gap-x-10 gap-y-1 text-foreground tabular-nums">
          <span>Face tags: {faceCount}</span>
          <span>Media items: {mediaItemCount}</span>
        </p>
      </div>
    </ConfirmActionDialog>
  );
}
