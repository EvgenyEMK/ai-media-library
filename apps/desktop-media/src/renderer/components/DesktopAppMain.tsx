import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import type { ImageEditSuggestionsItem } from "@emk/media-viewer";
import type { SemanticSearchResult } from "@emk/media-store";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import { DesktopMainToolbar } from "./DesktopMainToolbar";
import { DesktopMediaWorkspace } from "./DesktopMediaWorkspace";
import { DesktopPeopleSection } from "./DesktopPeopleSection";
import { DesktopProgressDock } from "./DesktopProgressDock";
import { DesktopSettingsSection } from "./DesktopSettingsSection";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import type {
  DesktopFilteredMediaItem,
  DesktopSemanticListItem,
} from "../hooks/use-filtered-media-items";
import type { PathExtractionSettings } from "../../shared/ipc";
import type {
  AnalysisEtaState,
  FaceEtaState,
  MetadataProgressState,
  SemanticIndexEtaState,
} from "../hooks/use-eta-tracking";
import type { DescEmbedBackfillState } from "./DesktopProgressDock";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import type { MainPaneViewMode } from "../types/app-types";

interface DesktopAppMainProps {
  store: DesktopStore;
  isPeopleSectionOpen: boolean;
  isSettingsSectionOpen: boolean;
  openFacePhotoInViewer: (args: {
    sourcePath: string;
    imageWidth?: number | null;
    imageHeight?: number | null;
    mediaItemId?: string | null;
  }) => void;
  faceDetectionSettings: DesktopStoreState["faceDetectionSettings"];
  photoAnalysisSettings: DesktopStoreState["photoAnalysisSettings"];
  folderScanningSettings: DesktopStoreState["folderScanningSettings"];
  aiImageSearchSettings: DesktopStoreState["aiImageSearchSettings"];
  mediaViewerSettings: DesktopStoreState["mediaViewerSettings"];
  pathExtractionSettings: PathExtractionSettings;
  selectedFolderLabel: string;
  quickFiltersActiveCount: number;
  mediaItemsLength: number;
  mediaImagesCount: number;
  mediaVideosCount: number;
  filteredMediaItemsLength: number;
  semanticModeActive: boolean;
  displaySemanticResultsCount: number;
  filteredDisplaySemanticResultsCount: number;
  selectedFolder: DesktopStoreState["selectedFolder"];
  aiPipelineStripRefreshKey: string;
  semanticPanelOpen: boolean;
  quickFiltersMenuOpen: boolean;
  setQuickFiltersMenuOpen: Dispatch<SetStateAction<boolean>>;
  quickFiltersMenuWrapRef: RefObject<HTMLDivElement | null>;
  quickFilters: ThumbnailQuickFilterState;
  setQuickFilters: Dispatch<SetStateAction<ThumbnailQuickFilterState>>;
  viewMode: DesktopStoreState["viewMode"];
  actionsMenuOpen: boolean;
  setActionsMenuOpen: Dispatch<SetStateAction<boolean>>;
  actionsMenuWrapRef: RefObject<HTMLDivElement | null>;
  mainPaneViewMode: MainPaneViewMode;
  setMainPaneViewMode: Dispatch<SetStateAction<MainPaneViewMode>>;
  pipeline: DesktopPipelineHandlers;
  descEmbedBackfillRunning: boolean;
  metadataScanFollowUp: DesktopStoreState["metadataScanFollowUp"];
  faceModelDownload: DesktopStoreState["faceModelDownload"];
  handleOpenFolderAiSummary: (folderPath: string) => void;
  imageEditSuggestionItems: ImageEditSuggestionsItem[];
  isFolderLoading: boolean;
  folderLoadProgress: { loaded: number; total: number | null };
  filteredMediaItems: DesktopFilteredMediaItem[];
  semanticResults: SemanticSearchResult[];
  displaySemanticResults: SemanticSearchResult[];
  filteredDisplaySemanticResults: SemanticSearchResult[];
  filteredSemanticListItems: DesktopSemanticListItem[];
  openFolderViewerById: (itemId: string) => void;
  progressPanelCollapsed: boolean;
  setProgressPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  analysisEta: AnalysisEtaState;
  faceEta: FaceEtaState;
  metadataProgress: MetadataProgressState;
  semanticIndexEta: SemanticIndexEtaState;
  descEmbedBackfill: DescEmbedBackfillState;
  setDescEmbedBackfill: Dispatch<SetStateAction<DescEmbedBackfillState>>;
}

export function DesktopAppMain({
  store,
  isPeopleSectionOpen,
  isSettingsSectionOpen,
  openFacePhotoInViewer,
  faceDetectionSettings,
  photoAnalysisSettings,
  folderScanningSettings,
    aiImageSearchSettings,
  mediaViewerSettings,
    pathExtractionSettings,
  selectedFolderLabel,
  quickFiltersActiveCount,
  mediaItemsLength,
  mediaImagesCount,
  mediaVideosCount,
  filteredMediaItemsLength,
  semanticModeActive,
  displaySemanticResultsCount,
  filteredDisplaySemanticResultsCount,
  selectedFolder,
  aiPipelineStripRefreshKey,
  semanticPanelOpen,
  quickFiltersMenuOpen,
  setQuickFiltersMenuOpen,
  quickFiltersMenuWrapRef,
  quickFilters,
  setQuickFilters,
  viewMode,
  actionsMenuOpen,
  setActionsMenuOpen,
  actionsMenuWrapRef,
  mainPaneViewMode,
  setMainPaneViewMode,
  pipeline,
  descEmbedBackfillRunning,
  metadataScanFollowUp,
  faceModelDownload,
  handleOpenFolderAiSummary,
  imageEditSuggestionItems,
  isFolderLoading,
  folderLoadProgress,
  filteredMediaItems,
  semanticResults,
  displaySemanticResults,
  filteredDisplaySemanticResults,
  filteredSemanticListItems,
  openFolderViewerById,
  progressPanelCollapsed,
  setProgressPanelCollapsed,
  analysisEta,
  faceEta,
  metadataProgress,
  semanticIndexEta,
  descEmbedBackfill,
  setDescEmbedBackfill,
}: DesktopAppMainProps): ReactElement {
  return (
    <main className="main-panel relative flex min-h-0 min-w-0 flex-col overflow-hidden">
      {isPeopleSectionOpen ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopPeopleSection onOpenFacePhoto={openFacePhotoInViewer} />
        </div>
      ) : isSettingsSectionOpen ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopSettingsSection
            faceDetectionSettings={faceDetectionSettings}
            photoAnalysisSettings={photoAnalysisSettings}
            folderScanningSettings={folderScanningSettings}
            aiImageSearchSettings={aiImageSearchSettings}
            mediaViewerSettings={mediaViewerSettings}
            onFaceDetectionSettingChange={(key, value) => store.getState().updateFaceDetectionSetting(key, value)}
            onResetFaceDetectionOnlySettings={() => store.getState().resetFaceDetectionOnlySettings()}
            onResetFaceRecognitionOnlySettings={() => store.getState().resetFaceRecognitionOnlySettings()}
            onPhotoAnalysisSettingChange={(key, value) => store.getState().updatePhotoAnalysisSetting(key, value)}
            onResetPhotoAnalysisSettings={() => store.getState().resetPhotoAnalysisSettings()}
            onFolderScanningSettingChange={(key, value) =>
              store.getState().updateFolderScanningSetting(key, value)
            }
            onResetFolderScanningSettings={() => store.getState().resetFolderScanningSettings()}
            onAiImageSearchSettingChange={(key, value) =>
              store.getState().updateAiImageSearchSetting(key, value)
            }
            onResetAiImageSearchSettings={() => store.getState().resetAiImageSearchSettings()}
            onMediaViewerSettingChange={(key, value) =>
              store.getState().updateMediaViewerSetting(key, value)
            }
            onResetMediaViewerSettings={() => store.getState().resetMediaViewerSettings()}
            pathExtractionSettings={pathExtractionSettings}
            onPathExtractionSettingChange={(key, value) =>
              store.getState().updatePathExtractionSetting(key, value)
            }
            onResetPathExtractionSettings={() => store.getState().resetPathExtractionSettings()}
          />
        </div>
      ) : (
        <>
          <DesktopMainToolbar
            store={store}
            selectedFolderLabel={selectedFolderLabel}
            quickFiltersActiveCount={quickFiltersActiveCount}
            mediaItemsLength={mediaItemsLength}
            mediaImagesCount={mediaImagesCount}
            mediaVideosCount={mediaVideosCount}
            filteredMediaItemsLength={filteredMediaItemsLength}
            semanticModeActive={semanticModeActive}
            displaySemanticResultsCount={displaySemanticResultsCount}
            filteredDisplaySemanticResultsCount={filteredDisplaySemanticResultsCount}
            selectedFolder={selectedFolder}
            aiPipelineStripRefreshKey={aiPipelineStripRefreshKey}
            semanticPanelOpen={semanticPanelOpen}
            quickFiltersMenuOpen={quickFiltersMenuOpen}
            setQuickFiltersMenuOpen={setQuickFiltersMenuOpen}
            quickFiltersMenuWrapRef={quickFiltersMenuWrapRef}
            quickFilters={quickFilters}
            setQuickFilters={setQuickFilters}
            viewMode={viewMode}
            actionsMenuOpen={actionsMenuOpen}
            setActionsMenuOpen={setActionsMenuOpen}
            actionsMenuWrapRef={actionsMenuWrapRef}
            setMainPaneViewMode={setMainPaneViewMode}
            pipeline={pipeline}
            descEmbedBackfillRunning={descEmbedBackfillRunning}
          />
          <DesktopMediaWorkspace
            store={store}
            mainPaneViewMode={mainPaneViewMode}
            setMainPaneViewMode={setMainPaneViewMode}
            selectedFolder={selectedFolder}
            semanticPanelOpen={semanticPanelOpen}
            metadataScanFollowUp={metadataScanFollowUp}
            faceModelDownload={faceModelDownload}
            pipeline={pipeline}
            handleOpenFolderAiSummary={handleOpenFolderAiSummary}
            imageEditSuggestionItems={imageEditSuggestionItems}
            mediaItemsLength={mediaItemsLength}
            isFolderLoading={isFolderLoading}
            folderLoadProgress={folderLoadProgress}
            filteredMediaItems={filteredMediaItems}
            viewMode={viewMode}
            semanticModeActive={semanticModeActive}
            semanticResults={semanticResults}
            displaySemanticResults={displaySemanticResults}
            filteredDisplaySemanticResults={filteredDisplaySemanticResults}
            filteredSemanticListItems={filteredSemanticListItems}
            quickFiltersActiveCount={quickFiltersActiveCount}
            openFolderViewerById={openFolderViewerById}
          />
        </>
      )}

      <DesktopProgressDock
        collapsed={progressPanelCollapsed}
        onToggleCollapsed={setProgressPanelCollapsed}
        analysisEta={analysisEta}
        faceEta={faceEta}
        metadataProgress={metadataProgress}
        semanticIndexEta={semanticIndexEta}
        onCancelMetadataScan={pipeline.handleCancelMetadataScan}
        onCancelAnalysis={pipeline.handleCancelAnalysis}
        onCancelFaceDetection={pipeline.handleCancelFaceDetection}
        onCancelSemanticIndex={() => void pipeline.handleCancelSemanticIndex()}
        onCancelFaceClustering={pipeline.handleCancelFaceClustering}
        onCancelSimilarUntaggedFaceCounts={pipeline.handleCancelSimilarUntaggedFaceCounts}
        onCancelPathAnalysis={() => void pipeline.handleCancelPathAnalysis()}
        descEmbedBackfill={descEmbedBackfill}
        onCancelDescEmbedBackfill={() => void pipeline.handleCancelDescEmbedBackfill()}
        onDismissDescEmbedBackfill={() => setDescEmbedBackfill((prev) => ({ ...prev, panelVisible: false }))}
      />
    </main>
  );
}
