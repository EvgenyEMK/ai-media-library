import type { FaceServiceStatus } from "@emk/media-store";
import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { FaceEtaState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

interface FaceDetectionCardProps {
  store: DesktopStore;
  faceEta: FaceEtaState;
  isDetectingFaces: boolean;
  faceJobId: string | null;
  faceError: string | null;
  faceCurrentFolderPath: string | null;
  faceServiceStatus: FaceServiceStatus | null;
  onCancelFaceDetection: () => void;
}

export function FaceDetectionCard({
  store,
  faceEta,
  isDetectingFaces,
  faceJobId,
  faceError,
  faceCurrentFolderPath,
  faceServiceStatus,
  onCancelFaceDetection,
}: FaceDetectionCardProps): ReactElement {
  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">
          {UI_TEXT.faceDetectionPanelTitle}
          {isDetectingFaces && faceCurrentFolderPath
            ? ` - ${faceCurrentFolderPath.split(/[\\/]/).pop()}`
            : ""}
        </h2>
        <div className="flex items-center gap-2">
          <ProgressDockCloseButton
            title={isDetectingFaces ? UI_TEXT.cancelFaceDetection : "Close face detection status"}
            ariaLabel={isDetectingFaces ? UI_TEXT.cancelFaceDetection : "Close face detection status"}
            disabled={isDetectingFaces && !faceJobId}
            onClick={() => {
              if (isDetectingFaces) {
                onCancelFaceDetection();
              }
              store.getState().setFacePanelVisible(false);
            }}
          />
        </div>
      </div>

      {faceServiceStatus && !faceServiceStatus.healthy ? (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/30 p-2 text-xs text-red-200">
          {UI_TEXT.faceDetectionServiceUnavailable}
          {faceServiceStatus.error ? ` Error: ${faceServiceStatus.error}` : ""}
        </div>
      ) : null}

      {faceError && (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {faceError}
        </div>
      )}

      {isDetectingFaces && faceEta.faceTotal === 0 ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          <span>{UI_TEXT.preparingFiles}</span>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2 overflow-auto">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Face detection progress">
            <div
              className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
              style={{ width: `${faceEta.faceProgressPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {`Processed: ${formatCountRatio(faceEta.faceProcessed, faceEta.faceTotal)} | Skipped: ${formatCount(faceEta.faceCounts.skipped)} | ${UI_TEXT.faceCountLabel}: ${formatCount(faceEta.faceCounts.faces)}`}
            {faceEta.faceTimeLeftText
              ? ` | ${UI_TEXT.analysisTimeLeftLabel}: ${faceEta.faceTimeLeftText}`
              : ""}
            {faceEta.faceCounts.failed > 0 ? ` | Failed: ${formatCount(faceEta.faceCounts.failed)}` : ""}
            {faceEta.faceCounts.cancelled > 0
              ? ` | Cancelled: ${formatCount(faceEta.faceCounts.cancelled)}`
              : ""}
          </div>
        </div>
      )}
    </section>
  );
}
