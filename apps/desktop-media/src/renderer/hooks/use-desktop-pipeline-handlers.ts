import { useMemo } from "react";
import type { SemanticSearchResult } from "@emk/media-store";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import { useFaceAndScanHandlers } from "./use-face-and-scan-handlers";
import { usePhotoAnalysisHandlers } from "./use-photo-analysis-handlers";
import { usePathAnalysisHandlers } from "./use-path-analysis-handlers";
import { useSemanticHandlers } from "./use-semantic-handlers";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";

type DescEmbedHandlers = {
  handleIndexDescEmbeddings: (folderPath: string, recursive: boolean) => Promise<void>;
  handleCancelDescEmbedBackfill: () => Promise<void>;
};

export type DesktopPipelineHandlers = {
  handleCancelMetadataScan: () => Promise<void>;
  handleAnalyzePhotos: (
    targetFolderPath?: string,
    recursive?: boolean,
    overrideExisting?: boolean,
  ) => Promise<void>;
  handleCancelAnalysis: () => Promise<void>;
  handleDetectFaces: (
    targetFolderPath?: string,
    recursive?: boolean,
    overrideExisting?: boolean,
  ) => Promise<void>;
  handleCancelFaceDetection: () => Promise<void>;
  handleCancelFaceClustering: () => void;
  handleCancelSimilarUntaggedFaceCounts: () => void;
  handleScanForFileChanges: (folderPath: string, recursive: boolean) => Promise<void>;
  handleSemanticSearch: () => Promise<void>;
  handleIndexSemantic: (
    folderPath: string,
    recursive: boolean,
    overrideExisting: boolean,
  ) => Promise<void>;
  handleCancelSemanticIndex: () => Promise<void>;
  handleIndexDescEmbeddings: (folderPath: string, recursive: boolean) => Promise<void>;
  handleCancelDescEmbedBackfill: () => Promise<void>;
  handleAnalyzeFolderPathMetadata: (folderPath: string, recursive: boolean) => Promise<void>;
  handleCancelPathAnalysis: () => Promise<void>;
  handleCancelImageRotation: () => Promise<void>;
};

export function useDesktopPipelineHandlers(opts: {
  store: DesktopStore;
  selectedFolder: string | null;
  photoAnalysisSettings: DesktopStoreState["photoAnalysisSettings"];
  aiSelectedModel: string;
  aiThinkingEnabled: boolean;
  aiJobId: string | null;
  faceDetectionSettings: DesktopStoreState["faceDetectionSettings"];
  faceJobId: string | null;
  metadataJobId: string | null;
  semanticQuery: string;
  semanticResults: SemanticSearchResult[];
  semanticIndexJobId: string | null;
  quickFilters: ThumbnailQuickFilterState;
  descEmbedHandlers: DescEmbedHandlers;
  setProgressPanelCollapsed: (collapsed: boolean) => void;
}): DesktopPipelineHandlers {
  const {
    store,
    selectedFolder,
    photoAnalysisSettings,
    aiSelectedModel,
    aiThinkingEnabled,
    aiJobId,
    faceDetectionSettings,
    faceJobId,
    metadataJobId,
    semanticQuery,
    semanticResults,
    semanticIndexJobId,
    quickFilters,
    descEmbedHandlers,
    setProgressPanelCollapsed,
  } = opts;

  const photo = usePhotoAnalysisHandlers({
    store,
    selectedFolder,
    photoAnalysisSettings,
    aiSelectedModel,
    aiThinkingEnabled,
    aiJobId,
    setProgressPanelCollapsed,
  });

  const faceAndScan = useFaceAndScanHandlers({
    store,
    selectedFolder,
    faceDetectionSettings,
    faceJobId,
    metadataJobId,
    setProgressPanelCollapsed,
  });

  const semantic = useSemanticHandlers({
    store,
    semanticQuery,
    semanticResults,
    semanticIndexJobId,
    quickFilters,
    setProgressPanelCollapsed,
  });

  const pathAnalysis = usePathAnalysisHandlers({ store, setProgressPanelCollapsed });

  return useMemo(
    (): DesktopPipelineHandlers => ({
      ...photo,
      ...faceAndScan,
      ...semantic,
      ...pathAnalysis,
      handleCancelImageRotation: async () => {
        const jobId = store.getState().imageRotationJobId;
        if (!jobId) return;
        await window.desktopApi.cancelImageRotationDetection(jobId);
      },
      handleIndexDescEmbeddings: descEmbedHandlers.handleIndexDescEmbeddings,
      handleCancelDescEmbedBackfill: descEmbedHandlers.handleCancelDescEmbedBackfill,
    }),
    [photo, faceAndScan, semantic, pathAnalysis, descEmbedHandlers, store],
  );
}
