import { useMemo } from "react";
import type { DesktopStore } from "../stores/desktop-store";

export type PathAnalysisHandlers = {
  handleAnalyzeFolderPathMetadata: (folderPath: string, recursive: boolean) => Promise<void>;
  handleCancelPathAnalysis: () => Promise<void>;
};

export function usePathAnalysisHandlers(opts: {
  store: DesktopStore;
  setProgressPanelCollapsed: (collapsed: boolean) => void;
}): PathAnalysisHandlers {
  const { store, setProgressPanelCollapsed } = opts;

  return useMemo(
    (): PathAnalysisHandlers => ({
      handleAnalyzeFolderPathMetadata: async (folderPath: string, recursive: boolean) => {
        const trimmed = folderPath.trim();
        if (!trimmed) return;

        setProgressPanelCollapsed(false);
        const { llmModel } = store.getState().pathExtractionSettings;
        try {
          await window.desktopApi.analyzeFolderPathMetadata({
            folderPath: trimmed,
            recursive,
            model: llmModel.trim() || undefined,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Path analysis failed to start";
          store.setState((s) => {
            s.pathAnalysisStatus = "idle";
            s.pathAnalysisJobId = null;
            s.pathAnalysisPanelVisible = true;
            s.pathAnalysisError = message;
          });
        }
      },
      handleCancelPathAnalysis: async () => {
        const jobId = store.getState().pathAnalysisJobId;
        if (!jobId) return;
        await window.desktopApi.cancelPathAnalysis(jobId);
      },
    }),
    [store, setProgressPanelCollapsed],
  );
}
