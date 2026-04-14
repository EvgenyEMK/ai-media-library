import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { DesktopStore } from "../stores/desktop-store";
import type { SidebarSectionId } from "../types/app-types";

export function useAppStoreSideEffects(opts: {
  store: DesktopStore;
  photoAnalysisSettingsModel: string | undefined;
  metadataPanelVisible: boolean;
  setProgressPanelCollapsed: (collapsed: boolean) => void;
  selectedModelSupportsThinking: boolean;
  aiThinkingEnabled: boolean;
  sidebarCollapsed: boolean;
  setExpandedSidebarSection: Dispatch<SetStateAction<SidebarSectionId | null>>;
}): void {
  const {
    store,
    photoAnalysisSettingsModel,
    metadataPanelVisible,
    setProgressPanelCollapsed,
    selectedModelSupportsThinking,
    aiThinkingEnabled,
    sidebarCollapsed,
    setExpandedSidebarSection,
  } = opts;

  useEffect(() => {
    const next = photoAnalysisSettingsModel?.trim();
    if (next && next !== store.getState().aiSelectedModel) {
      store.getState().setAiSelectedModel(next);
    }
  }, [photoAnalysisSettingsModel, store]);

  useEffect(() => {
    if (metadataPanelVisible) setProgressPanelCollapsed(false);
  }, [metadataPanelVisible, setProgressPanelCollapsed]);

  useEffect(() => {
    if (!selectedModelSupportsThinking && aiThinkingEnabled) {
      store.getState().setAiThinkingEnabled(false);
    }
  }, [selectedModelSupportsThinking, aiThinkingEnabled, store]);

  useEffect(() => {
    if (sidebarCollapsed) setExpandedSidebarSection(null);
  }, [sidebarCollapsed, setExpandedSidebarSection]);
}
