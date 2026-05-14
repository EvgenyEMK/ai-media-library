import { X } from "lucide-react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";
import { AI_MODEL_REFERENCE_ROWS } from "./ai-models-reference-data";

export function AiModelsReferenceSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement | null {
  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI models and licenses"
        className="relative flex max-h-[85vh] w-full max-w-[57.5rem] flex-col overflow-hidden rounded-xl border-2 border-primary/70 bg-background shadow-2xl"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_0%_0%,hsl(var(--primary)/0.16),transparent_58%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_100%_100%,hsl(var(--primary)/0.14),transparent_58%)]"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative shrink-0 border-b border-primary/25 px-6 pb-4 pt-4 md:px-10">
            <button
              type="button"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-secondary p-0 text-muted-foreground shadow-none hover:text-foreground"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <h2 className="m-0 pr-12 text-lg font-semibold leading-snug text-foreground md:text-xl">
              AI models and licenses
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-4 md:px-10">
            <p className="m-0 mb-3 text-sm text-muted-foreground">
              Short reference only—verify each vendor page before production use. Installed model ids are chosen in
              Settings.
            </p>
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-semibold text-foreground">Purpose</th>
                  <th className="py-2 pr-3 font-semibold text-foreground">Model / family</th>
                  <th className="py-2 font-semibold text-foreground">License</th>
                </tr>
              </thead>
              <tbody>
                {AI_MODEL_REFERENCE_ROWS.map((row) => (
                  <tr key={row.purpose} className="border-b border-border/70 align-top">
                    <td className="py-2 pr-3 text-foreground">{row.purpose}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.nameOrFamily}</td>
                    <td className="py-2">
                      <a
                        href={row.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary underline-offset-2 hover:underline"
                      >
                        {row.licenseUrl}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
