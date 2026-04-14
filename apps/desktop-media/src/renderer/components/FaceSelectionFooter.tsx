import { X } from "lucide-react";
import type { ReactElement } from "react";

interface FaceSelectionFooterProps {
  hidden: boolean;
  isDeclined: boolean;
  isDisabled: boolean;
  onToggleDecline: () => void;
  scorePercentLabel?: string;
}

export function FaceSelectionFooter({
  hidden,
  isDeclined,
  isDisabled,
  onToggleDecline,
  scorePercentLabel,
}: FaceSelectionFooterProps): ReactElement {
  if (hidden) {
    return <div className="mt-2 h-7" />;
  }

  return (
    <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={onToggleDecline}
        disabled={isDisabled}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-50 ${
          isDeclined
            ? "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/25"
            : "border-border text-muted-foreground hover:bg-muted"
        }`}
        aria-label={isDeclined ? "Undo hide" : "Hide this face from row accept"}
        title={isDeclined ? "Undo hide" : "Hide this face from row accept"}
      >
        <X className="size-6" />
      </button>
      {scorePercentLabel ? <span>{scorePercentLabel}</span> : null}
    </div>
  );
}
