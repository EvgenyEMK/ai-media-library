import { useEffect, useState, type ReactElement } from "react";
import type { EnqueueBundleRequest } from "../../shared/pipeline-ipc";

/**
 * UI-friendly description of a preset offered in the sheet. The `args`
 * function maps the form state (folderPath, recursive) into the preset's
 * args bag — the main process resolves the preset and constructs the bundle.
 *
 * Phase 5 ships with a curated subset of presets that the new scheduler can
 * actually execute (i.e. those whose pipeline definitions are real, not
 * stubs). Phase 3 onwards adds more presets here as additional pipelines
 * graduate from stub status.
 */
interface PresetOption {
  id: string;
  label: string;
  description: string;
  /**
   * If true, the preset operates on a specific folder. The form shows the
   * folder input and `recursive` toggle. Otherwise the preset uses no folder
   * args (e.g. library-wide path-extraction refresh).
   */
  needsFolder: boolean;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: "geo-only",
    label: "Reverse geocode GPS",
    description:
      "Look up country / city / area from existing GPS coordinates. Initialises the offline geocoder if needed.",
    needsFolder: true,
  },
  {
    id: "path-rule-only",
    label: "Extract dates from filenames (rules)",
    description:
      "Re-runs the rule-based path/filename date extractor library-wide. Useful after editing path-extraction settings.",
    needsFolder: false,
  },
  {
    id: "path-and-geo",
    label: "Path + GPS rules",
    description:
      "Runs path-rule extraction first, then GPS reverse-geocoding. No AI work — fast and safe to re-run.",
    needsFolder: true,
  },
];

interface RunPipelinesSheetProps {
  /** Folder path to default the form to (typically the currently selected folder). */
  defaultFolderPath: string | null;
  isAnyPipelineRunning: boolean;
  onClose: () => void;
}

/**
 * Sheet for enqueuing a preset bundle through the new pipeline scheduler.
 * Renders an overlay-style dialog (matching {@link PipelineBlockedDialog}) so
 * we don't need a Radix dialog primitive.
 *
 * On submit, calls `window.desktopApi.pipelines.enqueueBundle(...)` with a
 * `kind: "preset"` request. The dock's `PipelineQueueCards` immediately
 * reflects the new bundle once `pipelines:queue-changed` fires.
 *
 * Concurrency hint: the button label switches between "Run now" (idle) and
 * "Add to queue" (something already running) so the user understands FIFO
 * sequencing without a separate explanation. Either way the request is the
 * same — the scheduler decides when to start.
 */
export function RunPipelinesSheet({
  defaultFolderPath,
  isAnyPipelineRunning,
  onClose,
}: RunPipelinesSheetProps): ReactElement {
  const [presetId, setPresetId] = useState<string>(PRESET_OPTIONS[0]!.id);
  const [folderPath, setFolderPath] = useState<string>(defaultFolderPath ?? "");
  const [recursive, setRecursive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const selected = PRESET_OPTIONS.find((p) => p.id === presetId) ?? PRESET_OPTIONS[0]!;

  useEffect(() => {
    setFolderPath(defaultFolderPath ?? "");
  }, [defaultFolderPath]);

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const args: Record<string, unknown> = {};
      if (selected.needsFolder && folderPath.trim().length > 0) {
        args.folderPath = folderPath.trim();
        args.recursive = recursive;
      }
      const request: EnqueueBundleRequest = {
        kind: "preset",
        payload: { presetId: selected.id, args },
      };
      const result = await window.desktopApi.pipelines.enqueueBundle(request);
      if (!result.ok) {
        setError(`Could not enqueue: ${describeRejection(result.rejection)}`);
        return;
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = isAnyPipelineRunning ? "Add to queue" : "Run now";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Run pipelines"
    >
      <div className="flex w-full max-w-[640px] flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">Run pipelines</h2>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Preset</label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="h-8 rounded border border-input bg-background px-2 text-sm"
          >
            {PRESET_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{selected.description}</p>
        </div>

        {selected.needsFolder ? (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground" htmlFor="run-pipelines-folder">
                Folder (leave empty for entire library)
              </label>
              <input
                id="run-pipelines-folder"
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/path/to/folder"
                className="h-8 rounded border border-input bg-background px-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
              />
              <span>Include subfolders</span>
            </label>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-secondary px-3 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-3 text-sm text-white disabled:opacity-50"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={submitting}
          >
            {submitting ? "…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function describeRejection(rejection: { kind: string }): string {
  switch (rejection.kind) {
    case "unknown-pipeline":
      return "preset or pipeline is not registered";
    case "invalid-binding":
      return "invalid binding between bundle steps";
    case "validation-failed":
      return "params failed validation";
    default:
      return rejection.kind;
  }
}
