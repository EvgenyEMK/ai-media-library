import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import {
  getFaceModelDownloadCardAriaLabel,
  getFaceModelDownloadCardTitle,
} from "../../../lib/face-model-download-title";
import type { DesktopStore, DesktopStoreState } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { ProgressCardBody } from "./ProgressCardBody";

type FaceModelDownloadState = DesktopStoreState["faceModelDownload"];

interface FaceModelDownloadCardProps {
  store: DesktopStore;
  faceModelDownload: FaceModelDownloadState;
}

export function formatModelDownloadBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "?";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function getModelDownloadProgressPercent(download: FaceModelDownloadState): number {
  if (download.status === "completed") return 100;
  return Math.max(0, Math.min(100, download.percent ?? 5));
}

function getModelDownloadStatsText(download: FaceModelDownloadState): string {
  const filename = download.filename ? `File: ${download.filename}` : "Preparing model download";
  const percent = download.percent !== null ? `${download.percent}%` : "estimating";
  const bytes = `${formatModelDownloadBytes(download.downloadedBytes)}${
    download.totalBytes !== null ? ` / ${formatModelDownloadBytes(download.totalBytes)}` : ""
  }`;
  return `${filename} · ${percent} · ${bytes}`;
}

export function FaceModelDownloadCard({
  store,
  faceModelDownload,
}: FaceModelDownloadCardProps): ReactElement {
  const isRunning = faceModelDownload.status === "running";
  const titleText = faceModelDownload.message || "Downloading AI face detection and recognition models...";
  const messageForPurpose =
    faceModelDownload.message.trim().length > 0
      ? faceModelDownload.message
      : "Downloading AI face detection and recognition models...";
  const cardTitle = getFaceModelDownloadCardTitle({
    filename: faceModelDownload.filename,
    message: messageForPurpose,
  });
  const progressAriaLabel = getFaceModelDownloadCardAriaLabel({
    filename: faceModelDownload.filename,
    message: messageForPurpose,
  });

  return (
    <ProgressCardBody
      title={
        <>
          {isRunning ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : null}
          <span className="min-w-0">{cardTitle}</span>
        </>
      }
      action={
        isRunning ? null : (
          <ProgressDockCloseButton
            title="Close"
            ariaLabel="Close AI model download status"
            onClick={() => {
              store.setState((s) => {
                s.faceModelDownload.visible = false;
              });
            }}
          />
        )
      }
      progressPercent={getModelDownloadProgressPercent(faceModelDownload)}
      ariaLabel={progressAriaLabel}
      statsText={getModelDownloadStatsText(faceModelDownload)}
      rightText={titleText}
      showProgress={isRunning || faceModelDownload.status === "completed"}
      error={faceModelDownload.error ? `${faceModelDownload.message} ${faceModelDownload.error}` : null}
    />
  );
}
