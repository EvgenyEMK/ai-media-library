import { X } from "lucide-react";
import { useRef, type ReactElement } from "react";

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
  const handledPointerDownRef = useRef(false);

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={(event) => {
        if (disabled) return;
        handledPointerDownRef.current = true;
        event.preventDefault();
        onClick();
      }}
      onClick={() => {
        if (handledPointerDownRef.current) {
          handledPointerDownRef.current = false;
          return;
        }
        onClick();
      }}
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}
