import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

interface ImageRotationCardProps {
  store: DesktopStore;
  isImageRotationRunning: boolean;
  imageRotationJobId: string | null;
  imageRotationProcessed: number;
  imageRotationTotal: number;
  imageRotationWronglyRotated: number;
  imageRotationSkipped: number;
  imageRotationFailed: number;
  imageRotationFolderPath: string | null;
  imageRotationError: string | null;
  onCancelImageRotation: () => void;
}

export function ImageRotationCard({
  store,
  isImageRotationRunning,
  imageRotationJobId,
  imageRotationProcessed,
  imageRotationTotal,
  imageRotationWronglyRotated,
  imageRotationSkipped,
  imageRotationFailed,
  imageRotationFolderPath,
  imageRotationError,
  onCancelImageRotation,
}: ImageRotationCardProps): ReactElement {
  const progressPercent =
    imageRotationTotal > 0 ? Math.min(100, Math.round((imageRotationProcessed / imageRotationTotal) * 100)) : 0;
  const folderLabel = isImageRotationRunning && imageRotationFolderPath
    ? ` - ${imageRotationFolderPath.split(/[\\/]/).pop()}`
    : "";
  const stats = [
    `Processed: ${formatCountRatio(imageRotationProcessed, imageRotationTotal)}`,
    `Wrongly rotated: ${formatCount(imageRotationWronglyRotated)}`,
    imageRotationSkipped > 0 ? `Skipped: ${formatCount(imageRotationSkipped)}` : null,
    imageRotationFailed > 0 ? `Failed: ${formatCount(imageRotationFailed)}` : null,
  ].filter((item): item is string => item !== null);

  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          {isImageRotationRunning ? <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden="true" /> : null}
          <span>{`Wrongly rotated images${folderLabel}`}</span>
        </h2>
        <ProgressDockCloseButton
          title={isImageRotationRunning ? "Cancel image rotation detection" : "Close image rotation status"}
          ariaLabel={isImageRotationRunning ? "Cancel image rotation detection" : "Close image rotation status"}
          disabled={isImageRotationRunning && !imageRotationJobId}
          onClick={() => {
            if (isImageRotationRunning) {
              onCancelImageRotation();
            }
            store.getState().setImageRotationPanelVisible(false);
          }}
        />
      </div>
      {imageRotationError ? (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {imageRotationError}
        </div>
      ) : null}
      {(isImageRotationRunning || imageRotationTotal > 0) ? (
        <div className="mt-2 flex flex-col gap-2 overflow-auto">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Image rotation progress">
            <div className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">
            {stats.join(" | ")}
          </div>
        </div>
      ) : null}
    </section>
  );
}
