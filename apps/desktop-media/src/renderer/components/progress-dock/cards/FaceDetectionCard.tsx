import type { FaceServiceStatus } from "@emk/media-store";
import type { ReactElement } from "react";
import type { FaceEtaState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { ProgressCardBody } from "./ProgressCardBody";

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
  const shouldShowProgress = isDetectingFaces || faceEta.faceTotal > 0;
  const progressPercent = faceEta.faceProgressPercent;
  const statsText = `Processed: ${formatCountRatio(faceEta.faceProcessed, faceEta.faceTotal)} | Faces: ${formatCount(faceEta.faceCounts.faces)}${
    faceEta.faceCounts.skipped > 0 ? ` | Skipped: ${formatCount(faceEta.faceCounts.skipped)}` : ""
  }${
    faceEta.faceCounts.failed > 0 ? ` | Failed: ${formatCount(faceEta.faceCounts.failed)}` : ""
  }${
    faceEta.faceCounts.cancelled > 0 ? ` | Cancelled: ${formatCount(faceEta.faceCounts.cancelled)}` : ""
  }`;
  const rightText = faceEta.faceTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${faceEta.faceTimeLeftText}`
    : null;
  const errorText =
    faceServiceStatus && !faceServiceStatus.healthy
      ? `${UI_TEXT.faceDetectionServiceUnavailable}${faceServiceStatus.error ? ` Error: ${faceServiceStatus.error}` : ""}`
      : faceError;

  return (
    <ProgressCardBody
      title={`${UI_TEXT.faceDetectionPanelTitle}${
        isDetectingFaces && faceCurrentFolderPath ? ` - ${faceCurrentFolderPath.split(/[\\/]/).pop()}` : ""
      }`}
      action={
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
      }
      progressPercent={progressPercent}
      ariaLabel="Face detection progress"
      statsText={statsText}
      rightText={rightText}
      error={errorText}
      showProgress={shouldShowProgress}
    />
  );
}
