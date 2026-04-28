import type { ReactElement } from "react";

export function PipelineBlockedDialog({ onClose }: { onClose: () => void }): ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pipeline already running"
    >
      <div className="w-full max-w-[520px] rounded-lg border border-border bg-card p-4 shadow-xl">
        <p className="m-0 text-sm text-foreground">
          Please cancel currently running process or wait until it finishes
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-secondary px-3 text-sm shadow-none"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
