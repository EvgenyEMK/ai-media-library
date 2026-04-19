import { X } from "lucide-react";
import type { ReactElement } from "react";

interface ProgressDockCloseButtonProps {
  title: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ProgressDockCloseButton({
  title,
  ariaLabel,
  disabled,
  onClick,
}: ProgressDockCloseButtonProps): ReactElement {
  return (
    <button type="button" title={title} aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      <X size={14} aria-hidden="true" />
    </button>
  );
}
