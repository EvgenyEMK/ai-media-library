import { useMemo } from "react";
import { UI_TEXT } from "../lib/ui-text";
import { enqueueFolderAiPipeline } from "../lib/enqueue-folder-ai-pipeline";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";

export function useFaceAndScanHandlers(opts: {
  store: DesktopStore;
  selectedFolder: string | null;
  faceDetectionSettings: DesktopStoreState["faceDetectionSettings"];
  faceJobId: string | null;
  metadataJobId: string | null;
  setProgressPanelCollapsed: (collapsed: boolean) => void;
}): {
  handleCancelMetadataScan: () => Promise<void>;
  handleDetectFaces: (
    targetFolderPath?: string,
    recursive?: boolean,
    overrideExisting?: boolean,
  ) => Promise<void>;
  handleCancelFaceDetection: () => Promise<void>;
  handleCancelFaceClustering: () => void;
  handleCancelSimilarUntaggedFaceCounts: () => void;
  handleScanForFileChanges: (folderPath: string, recursive: boolean) => Promise<void>;
} {
  const {
    store,
    selectedFolder,
    faceDetectionSettings,
    faceJobId,
    metadataJobId,
    setProgressPanelCollapsed,
  } = opts;

  return useMemo(() => {
    const handleCancelMetadataScan = async (): Promise<void> => {
      if (!metadataJobId) return;
      await window.desktopApi.cancelMetadataScan(metadataJobId);
    };

    const handleDetectFaces = async (
      targetFolderPath?: string,
      recursive = true,
      overrideExisting = false,
    ): Promise<void> => {
      const folderPath = targetFolderPath ?? selectedFolder;
      if (!folderPath) return;
      store.setState((s) => {
        s.faceError = null;
      });
      try {
        await enqueueFolderAiPipeline({
          folderPath,
          pipeline: "face",
          recursive,
          overrideExisting,
          faceDetectionSettings,
        });
        setProgressPanelCollapsed(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : UI_TEXT.faceDetectionFailed;
        store.setState((s) => {
          s.faceError = message;
          s.faceStatus = "failed";
        });
      }
    };

    const handleCancelFaceDetection = async (): Promise<void> => {
      if (!faceJobId) return;
      await window.desktopApi.cancelFaceDetection(faceJobId);
    };

    const handleCancelFaceClustering = (): void => {
      const jobId = store.getState().faceClusteringJobId;
      if (jobId) {
        void window.desktopApi.cancelFaceClustering(jobId);
      }
    };

    const handleCancelSimilarUntaggedFaceCounts = (): void => {
      const jobId = store.getState().similarUntaggedCountsJobId;
      if (jobId) {
        void window.desktopApi.cancelSimilarUntaggedFaceCountsJob(jobId);
      }
    };

    const handleScanForFileChanges = async (folderPath: string, recursive: boolean): Promise<void> => {
      if (!folderPath) return;
      store.getState().setMetadataPanelVisible(true);
      setProgressPanelCollapsed(false);
      await window.desktopApi.scanFolderMetadata({ folderPath, recursive });
    };

    return {
      handleCancelMetadataScan,
      handleDetectFaces,
      handleCancelFaceDetection,
      handleCancelFaceClustering,
      handleCancelSimilarUntaggedFaceCounts,
      handleScanForFileChanges,
    };
  }, [
    store,
    selectedFolder,
    faceDetectionSettings,
    faceJobId,
    metadataJobId,
    setProgressPanelCollapsed,
  ]);
}
