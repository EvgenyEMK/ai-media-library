import { BrowserWindow } from "electron";
import {
  IPC_CHANNELS,
  type FaceClusteringProgressEvent,
  type FaceDetectionProgressEvent,
  type FaceEmbeddingProgressEvent,
  type FolderMediaProgressEvent,
  type FolderImagesProgressEvent,
  type GeocoderInitProgressEvent,
  type MetadataScanProgressEvent,
  type PathAnalysisProgressEvent,
  type PhotoAnalysisProgressEvent,
  type SemanticIndexProgressEvent,
} from "../../src/shared/ipc";

let frameSendErrorLogged = false;

/**
 * Best-effort IPC send that survives renderer frame disposal (e.g. after
 * Windows sleep/lock causes the Chromium render process to die while a
 * long-running main-process job is still active).
 *
 * The window may still exist (`isDestroyed() === false`) while its internal
 * render frame is gone, causing `webContents.send` to throw
 * "Render frame was disposed before WebFrameMain could be accessed".
 */
function safeSend(browserWindow: BrowserWindow, channel: string, payload: unknown): void {
  if (browserWindow.isDestroyed()) return;
  try {
    browserWindow.webContents.send(channel, payload);
  } catch (error: unknown) {
    if (!frameSendErrorLogged) {
      frameSendErrorLogged = true;
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ipc] send to renderer failed (frame likely disposed), suppressing further warnings: ${msg}`,
      );
    }
  }
}

/** Reset the one-shot log guard after a renderer reload restores the frame. */
export function resetFrameSendErrorFlag(): void {
  frameSendErrorLogged = false;
}

export function emitPhotoProgress(
  browserWindow: BrowserWindow,
  payload: PhotoAnalysisProgressEvent,
): void {
  safeSend(browserWindow, IPC_CHANNELS.photoAnalysisProgress, payload);
}

export function emitFaceDetectionProgress(
  browserWindow: BrowserWindow,
  payload: FaceDetectionProgressEvent,
): void {
  safeSend(browserWindow, IPC_CHANNELS.faceDetectionProgress, payload);
}

export function emitFaceEmbeddingProgress(
  browserWindow: BrowserWindow,
  payload: FaceEmbeddingProgressEvent,
): void {
  safeSend(browserWindow, IPC_CHANNELS.faceEmbeddingProgress, payload);
}

export function emitMetadataScanProgress(payload: MetadataScanProgressEvent): void {
  BrowserWindow.getAllWindows().forEach((browserWindow) => {
    safeSend(browserWindow, IPC_CHANNELS.metadataScanProgress, payload);
  });
}

export function emitFolderImagesProgress(
  browserWindow: BrowserWindow,
  payload: FolderImagesProgressEvent,
): void {
  safeSend(browserWindow, IPC_CHANNELS.folderImagesProgress, payload);
}

export function emitFolderMediaProgress(
  browserWindow: BrowserWindow,
  payload: FolderMediaProgressEvent,
): void {
  safeSend(browserWindow, IPC_CHANNELS.folderMediaProgress, payload);
}

export function emitSemanticIndexProgress(
  browserWindow: BrowserWindow,
  payload: SemanticIndexProgressEvent,
): void {
  safeSend(browserWindow, IPC_CHANNELS.semanticIndexProgress, payload);
}

export function emitFaceClusteringProgress(
  browserWindow: BrowserWindow,
  payload: FaceClusteringProgressEvent,
): void {
  safeSend(browserWindow, IPC_CHANNELS.faceClusteringProgress, payload);
}

export function emitPathAnalysisProgress(payload: PathAnalysisProgressEvent): void {
  BrowserWindow.getAllWindows().forEach((browserWindow) => {
    safeSend(browserWindow, IPC_CHANNELS.pathAnalysisProgress, payload);
  });
}

export function emitGeocoderInitProgress(payload: GeocoderInitProgressEvent): void {
  BrowserWindow.getAllWindows().forEach((browserWindow) => {
    safeSend(browserWindow, IPC_CHANNELS.geocoderInitProgress, payload);
  });
}
