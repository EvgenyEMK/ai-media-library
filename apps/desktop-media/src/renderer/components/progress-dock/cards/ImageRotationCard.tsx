import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { ProgressCardBody } from "./ProgressCardBody";

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
  const statsText = `Processed: ${formatCountRatio(
    imageRotationProcessed,
    imageRotationTotal,
  )} | Wrongly rotated: ${formatCount(imageRotationWronglyRotated)}${
    imageRotationSkipped > 0 ? ` | Skipped: ${formatCount(imageRotationSkipped)}` : ""
  }${imageRotationFailed > 0 ? ` | Failed: ${formatCount(imageRotationFailed)}` : ""}`;

  return (
    <ProgressCardBody
      title={
        <>
          {isImageRotationRunning ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden="true" />
          ) : null}
          <span>{`Wrongly rotated images${folderLabel}`}</span>
        </>
      }
      action={
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
      }
      progressPercent={progressPercent}
      ariaLabel="Image rotation progress"
      statsText={statsText}
      error={imageRotationError}
      showProgress={isImageRotationRunning || imageRotationTotal > 0}
    />
  );
}
