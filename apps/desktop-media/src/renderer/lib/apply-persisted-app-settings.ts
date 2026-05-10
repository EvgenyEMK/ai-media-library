import type { AppSettings } from "../../shared/ipc";
import { DEFAULT_PHOTO_ANALYSIS_SETTINGS } from "../../shared/ipc";
import { refreshFolderAiRollups } from "../hooks/ipc-binding-helpers";
import type { DesktopStore } from "../stores/desktop-store";

/**
 * Applies settings read from the main process (or written there) to the desktop Zustand store.
 * Used on startup and after every successful `saveSettings` so the store cannot drift from disk.
 */
export function applyPersistedAppSettingsToStore(store: DesktopStore, settings: AppSettings): void {
  store.setState((s) => {
    s.clientId = settings.clientId;
    s.libraryRoots = settings.libraryRoots;
    s.sidebarCollapsed = settings.sidebarCollapsed;
    s.hideAdvancedSettings = settings.hideAdvancedSettings;
    s.wrongImageRotationDetectionSettings = settings.wrongImageRotationDetection;
    s.faceDetectionSettings = settings.faceDetection;
    s.photoAnalysisSettings = {
      ...DEFAULT_PHOTO_ANALYSIS_SETTINGS,
      ...(settings.photoAnalysis ?? {}),
    };
    if (settings.photoAnalysis?.model) {
      s.aiSelectedModel = settings.photoAnalysis.model;
    }
    s.folderScanningSettings = settings.folderScanning;
    s.smartAlbumSettings = settings.smartAlbums;
    s.aiImageSearchSettings = settings.aiImageSearch;
    s.mediaViewerSettings = settings.mediaViewer;
    s.pathExtractionSettings = settings.pathExtraction;
    s.aiInferencePreferredGpuId = settings.aiInferencePreferredGpuId;
    s.pipelineConcurrencySettings = settings.pipelineConcurrency;
  });
  void refreshFolderAiRollups(store);
}
