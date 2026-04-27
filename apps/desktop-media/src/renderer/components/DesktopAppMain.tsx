import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import type { ImageEditSuggestionsItem } from "@emk/media-viewer";
import type { SemanticSearchResult } from "@emk/media-store";
import type { SmartAlbumRootKind } from "@emk/shared-contracts";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import { DesktopMainToolbar } from "./DesktopMainToolbar";
import { DesktopMediaWorkspace } from "./DesktopMediaWorkspace";
import { DesktopAlbumsWorkspace } from "./DesktopAlbumsWorkspace";
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
import type { AlbumWorkspaceMode, MainPaneViewMode } from "../types/app-types";

interface DesktopAppMainProps {
  store: DesktopStore;
  isPeopleSectionOpen: boolean;
  isAlbumsSectionOpen: boolean;
  albumWorkspaceMode: AlbumWorkspaceMode;
  setAlbumWorkspaceMode: Dispatch<SetStateAction<AlbumWorkspaceMode>>;
  smartAlbumRootKind: SmartAlbumRootKind;
  albumSearchControlsOpen: boolean;
  setAlbumSearchControlsOpen: Dispatch<SetStateAction<boolean>>;
  isSettingsSectionOpen: boolean;
  openFacePhotoInViewer: (args: {
    sourcePath: string;
    imageWidth?: number | null;
    imageHeight?: number | null;
    mediaItemId?: string | null;
  }) => void;
  faceDetectionSettings: DesktopStoreState["faceDetectionSettings"];
  wrongImageRotationDetectionSettings: DesktopStoreState["wrongImageRotationDetectionSettings"];
  photoAnalysisSettings: DesktopStoreState["photoAnalysisSettings"];
  folderScanningSettings: DesktopStoreState["folderScanningSettings"];
  smartAlbumSettings: DesktopStoreState["smartAlbumSettings"];
  aiImageSearchSettings: DesktopStoreState["aiImageSearchSettings"];
  hideAdvancedSettings: boolean;
  mediaViewerSettings: DesktopStoreState["mediaViewerSettings"];
  pathExtractionSettings: PathExtractionSettings;
  aiInferencePreferredGpuId: string | null;
  aiInferenceGpuOptions: DesktopStoreState["aiInferenceGpuOptions"];
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
  isAlbumsSectionOpen,
  albumWorkspaceMode,
  setAlbumWorkspaceMode,
  smartAlbumRootKind,
  albumSearchControlsOpen,
  setAlbumSearchControlsOpen,
  isSettingsSectionOpen,
  openFacePhotoInViewer,
  faceDetectionSettings,
  wrongImageRotationDetectionSettings,
  photoAnalysisSettings,
  folderScanningSettings,
  smartAlbumSettings,
  aiImageSearchSettings,
  hideAdvancedSettings,
  mediaViewerSettings,
  pathExtractionSettings,
  aiInferencePreferredGpuId,
  aiInferenceGpuOptions,
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
      {isAlbumsSectionOpen ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DesktopAlbumsWorkspace
            mode={albumWorkspaceMode}
            onModeChange={setAlbumWorkspaceMode}
            smartAlbumRootKind={smartAlbumRootKind}
            searchControlsOpen={albumSearchControlsOpen}
            onSearchControlsOpenChange={setAlbumSearchControlsOpen}
          />
        </div>
      ) : isPeopleSectionOpen ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopPeopleSection onOpenFacePhoto={openFacePhotoInViewer} />
        </div>
      ) : isSettingsSectionOpen ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopSettingsSection
            faceDetectionSettings={faceDetectionSettings}
            wrongImageRotationDetectionSettings={wrongImageRotationDetectionSettings}
            photoAnalysisSettings={photoAnalysisSettings}
            folderScanningSettings={folderScanningSettings}
            smartAlbumSettings={smartAlbumSettings}
            aiImageSearchSettings={aiImageSearchSettings}
            hideAdvancedSettings={hideAdvancedSettings}
            mediaViewerSettings={mediaViewerSettings}
            onFaceDetectionSettingChange={(key, value) => store.getState().updateFaceDetectionSetting(key, value)}
            onResetFaceDetectionOnlySettings={() => store.getState().resetFaceDetectionOnlySettings()}
            onResetFaceRecognitionOnlySettings={() => store.getState().resetFaceRecognitionOnlySettings()}
            onWrongImageRotationDetectionSettingChange={(key, value) =>
              store.getState().updateWrongImageRotationDetectionSetting(key, value)
            }
            onPhotoAnalysisSettingChange={(key, value) => store.getState().updatePhotoAnalysisSetting(key, value)}
            onResetPhotoAnalysisSettings={() => store.getState().resetPhotoAnalysisSettings()}
            onFolderScanningSettingChange={(key, value) =>
              store.getState().updateFolderScanningSetting(key, value)
            }
            onSmartAlbumSettingChange={(key, value) =>
              store.getState().updateSmartAlbumSetting(key, value)
            }
            onResetSmartAlbumSettings={() => store.getState().resetSmartAlbumSettings()}
            onResetFolderScanningSectionSettings={() => {
              store.getState().resetFolderScanningSettings();
              store.getState().resetPathExtractionSettings();
            }}
            onAiImageSearchSettingChange={(key, value) =>
              store.getState().updateAiImageSearchSetting(key, value)
            }
            onResetAiImageSearchSettings={() => store.getState().resetAiImageSearchSettings()}
            onHideAdvancedSettingsChange={(next) =>
              store.getState().setHideAdvancedSettings(next)
            }
            onMediaViewerSettingChange={(key, value) =>
              store.getState().updateMediaViewerSetting(key, value)
            }
            onResetMediaViewerSettings={() => store.getState().resetMediaViewerSettings()}
            pathExtractionSettings={pathExtractionSettings}
            aiInferencePreferredGpuId={aiInferencePreferredGpuId}
            aiInferenceGpuOptions={aiInferenceGpuOptions}
            onPathExtractionSettingChange={(key, value) =>
              store.getState().updatePathExtractionSetting(key, value)
            }
            onAiInferencePreferredGpuIdChange={(gpuId) =>
              store.getState().setAiInferencePreferredGpuId(gpuId)
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
          />
          <DesktopMediaWorkspace
            store={store}
            mainPaneViewMode={mainPaneViewMode}
            setMainPaneViewMode={setMainPaneViewMode}
            selectedFolder={selectedFolder}
            semanticPanelOpen={semanticPanelOpen}
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
        </div>
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
