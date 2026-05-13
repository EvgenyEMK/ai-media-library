import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { DesktopStore } from "../stores/desktop-store";
import type {
  DocumentsSidebarSubSection,
  ExpandedSidebarSectionId,
  InsightsSidebarSubSection,
} from "../types/app-types";

export function useAppStoreSideEffects(opts: {
  store: DesktopStore;
  photoAnalysisSettingsModel: string | undefined;
  metadataPanelVisible: boolean;
  setProgressPanelCollapsed: (collapsed: boolean) => void;
  selectedModelSupportsThinking: boolean;
  aiThinkingEnabled: boolean;
  sidebarCollapsed: boolean;
  documentsSubSection: DocumentsSidebarSubSection | null;
  insightsSubSection: InsightsSidebarSubSection | null;
  setExpandedSidebarSection: Dispatch<SetStateAction<ExpandedSidebarSectionId | null>>;
}): void {
  const {
    store,
    photoAnalysisSettingsModel,
    metadataPanelVisible,
    setProgressPanelCollapsed,
    selectedModelSupportsThinking,
    aiThinkingEnabled,
    sidebarCollapsed,
    documentsSubSection,
    insightsSubSection,
    setExpandedSidebarSection,
  } = opts;

  const prevSidebarCollapsedRef = useRef(sidebarCollapsed);

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

  /** After widening the left panel, re-open Documents/Insights if a child row is still active (accordion state is preserved while collapsed). */
  useEffect(() => {
    const wasCollapsed = prevSidebarCollapsedRef.current;
    if (wasCollapsed && !sidebarCollapsed) {
      if (documentsSubSection !== null) {
        setExpandedSidebarSection((current) => (current === "documents" ? current : "documents"));
      } else if (insightsSubSection !== null) {
        setExpandedSidebarSection((current) => (current === "insights" ? current : "insights"));
      }
    }
    prevSidebarCollapsedRef.current = sidebarCollapsed;
  }, [
    sidebarCollapsed,
    documentsSubSection,
    insightsSubSection,
    setExpandedSidebarSection,
  ]);
}
