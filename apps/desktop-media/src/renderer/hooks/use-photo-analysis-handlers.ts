import { useMemo, useRef } from "react";
import { supportsThinkingMode } from "../../shared/photo-analysis-prompt";
import { UI_TEXT } from "../lib/ui-text";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import { DEFAULT_PHOTO_ANALYSIS_SETTINGS } from "../../shared/ipc";

const DEBUG_PHOTO_AI =
  typeof process !== "undefined" && process.env?.EMK_DEBUG_PHOTO_AI === "1";

function nowIso(): string {
  return new Date().toISOString();
}

export function usePhotoAnalysisHandlers(opts: {
  store: DesktopStore;
  selectedFolder: string | null;
  photoAnalysisSettings: DesktopStoreState["photoAnalysisSettings"];
  aiSelectedModel: string;
  aiThinkingEnabled: boolean;
  aiJobId: string | null;
  setProgressPanelCollapsed: (collapsed: boolean) => void;
}): {
  handleAnalyzePhotos: (
    targetFolderPath?: string,
    recursive?: boolean,
    overrideExisting?: boolean,
  ) => Promise<void>;
  handleCancelAnalysis: () => Promise<void>;
} {
  const {
    store,
    selectedFolder,
    photoAnalysisSettings,
    aiSelectedModel,
    aiThinkingEnabled,
    aiJobId,
    setProgressPanelCollapsed,
  } = opts;

  const pendingAiCancelRef = useRef(false);

  return useMemo(() => {
    const handleAnalyzePhotos = async (
      targetFolderPath?: string,
      recursive = true,
      overrideExisting = false,
    ): Promise<void> => {
      const folderPath = targetFolderPath ?? selectedFolder;
      if (!folderPath) return;
      const resolvedModel = (photoAnalysisSettings.model ?? aiSelectedModel).trim() || DEFAULT_PHOTO_ANALYSIS_SETTINGS.model;
      if (resolvedModel !== store.getState().aiSelectedModel) store.getState().setAiSelectedModel(resolvedModel);

      store.setState((s) => {
        s.aiError = null;
        s.aiStatus = "running";
        s.aiPanelVisible = true;
        s.aiJobId = null;
        s.aiItemOrder = [];
        s.aiItemsByKey = {};
        s.aiAverageSecondsPerFile = null;
        s.aiCurrentFolderPath = null;
      });
      setProgressPanelCollapsed(false);
      if (DEBUG_PHOTO_AI) {
        console.log(
          `[photo-ai][renderer][${nowIso()}] analyze start folder="${folderPath}" model="${resolvedModel}" recursive=${recursive} mode=${overrideExisting ? "all" : "missing"}`,
        );
      }

      try {
        const result = await window.desktopApi.analyzeFolderPhotos({
          folderPath,
          mode: overrideExisting ? "all" : "missing",
          recursive,
          model: resolvedModel,
          think: supportsThinkingMode(resolvedModel) ? aiThinkingEnabled : false,
          timeoutMsPerImage: Math.max(
            10_000,
            Math.round(photoAnalysisSettings.analysisTimeoutPerImageSec * 1000),
          ),
          enableTwoPassRotationConsistency: photoAnalysisSettings.enableTwoPassRotationConsistency,
          useFaceFeaturesForRotation: photoAnalysisSettings.useFaceFeaturesForRotation,
          extractInvoiceData: photoAnalysisSettings.extractInvoiceData,
          concurrency: 2,
        });
        store.setState((s) => {
          s.aiJobId = result.jobId;
        });
        if (DEBUG_PHOTO_AI) {
          console.log(`[photo-ai][renderer][${nowIso()}] analyze IPC returned jobId=${result.jobId} total=${result.total}`);
        }
        if (pendingAiCancelRef.current) {
          if (DEBUG_PHOTO_AI) {
            console.log(`[photo-ai][renderer][${nowIso()}] cancel was queued; sending cancel for jobId=${result.jobId}`);
          }
          pendingAiCancelRef.current = false;
          await window.desktopApi.cancelPhotoAnalysis(result.jobId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : UI_TEXT.analysisFailed;
        store.setState((s) => {
          s.aiError = message;
          s.aiStatus = "failed";
        });
        if (DEBUG_PHOTO_AI) {
          console.log(`[photo-ai][renderer][${nowIso()}][error] analyze failed: ${message}`);
        }
      }
    };

    const handleCancelAnalysis = async (): Promise<void> => {
      if (!aiJobId) {
        if (store.getState().aiStatus === "running") {
          pendingAiCancelRef.current = true;
          if (DEBUG_PHOTO_AI) {
            console.log(
              `[photo-ai][renderer][${nowIso()}] cancel queued (aiJobId not yet known) aiStatus=${store.getState().aiStatus}`,
            );
          }
        }
        return;
      }
      pendingAiCancelRef.current = false;
      if (DEBUG_PHOTO_AI) {
        console.log(`[photo-ai][renderer][${nowIso()}] cancel sending IPC jobId=${aiJobId}`);
      }
      store.setState((s) => {
        s.aiStatus = "completed";
        s.aiPhase = null;
        s.aiCurrentFolderPath = null;
      });
      const accepted = await window.desktopApi.cancelPhotoAnalysis(aiJobId);
      if (!accepted) {
        store.setState((s) => {
          s.aiStatus = "completed";
          s.aiPhase = null;
          s.aiJobId = null;
          s.aiCurrentFolderPath = null;
        });
        if (DEBUG_PHOTO_AI) {
          console.log(`[photo-ai][renderer][${nowIso()}] cancel returned false; forcing local completion state`);
        }
      }
    };

    return { handleAnalyzePhotos, handleCancelAnalysis };
  }, [
    store,
    selectedFolder,
    photoAnalysisSettings,
    aiSelectedModel,
    aiThinkingEnabled,
    aiJobId,
    setProgressPanelCollapsed,
  ]);
}
