import { type ReactElement, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function ConfirmActionDialog({
  open,
  title,
  confirmLabel,
  cancelLabel = "Cancel",
  isBusy,
  tone = "destructive",
  emphasizeCancel = tone === "destructive",
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  isBusy: boolean;
  tone?: "destructive" | "default";
  /** When true, Cancel looks like the primary/safe choice (keyboard default stays Cancel). */
  emphasizeCancel?: boolean;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement | null {
  if (!open) return null;

  const confirmClass =
    emphasizeCancel && tone === "destructive"
      ? "border border-destructive/55 bg-transparent text-destructive hover:bg-destructive/10"
      : tone === "destructive"
        ? "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/15"
        : "border-primary bg-primary/10 text-primary hover:bg-primary/15";

  const cancelClass = emphasizeCancel
    ? "border-2 border-primary bg-background px-3 font-medium text-foreground shadow-sm ring-2 ring-ring/40 hover:bg-muted"
    : "border border-border px-3 hover:bg-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`mt-1 size-6 shrink-0 ${tone === "destructive" ? "text-destructive" : "text-primary"}`}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            disabled={isBusy}
            onClick={onCancel}
            className={`inline-flex h-9 items-center justify-center rounded-md text-sm disabled:opacity-50 ${cancelClass}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onConfirm}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm disabled:opacity-50 ${confirmClass}`}
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
