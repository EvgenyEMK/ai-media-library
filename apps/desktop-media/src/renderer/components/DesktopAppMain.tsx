import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import type { ImageEditSuggestionsItem } from "@emk/media-viewer";
import type { SemanticSearchResult } from "@emk/media-store";
import type { SmartAlbumRootKind, SmartAlbumYearAreaSubView } from "@emk/shared-contracts";
import type { DuplicateFilesSession } from "../types/duplicate-files-session";
import { DesktopDuplicateFilesScanningShell } from "./duplicate-files/desktop-duplicate-files-scanning-shell";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import { DesktopSimilarImagesWorkspace, type SimilarImagesSession } from "./similar-images/desktop-similar-images-workspace";
import { DesktopDuplicateFilesWorkspace } from "./duplicate-files/desktop-duplicate-files-workspace";
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
import type { AlbumWorkspaceMode, MainPaneViewMode, RotationReviewScope } from "../types/app-types";
import { DesktopInsightLibraryPickHub } from "./insights/desktop-insight-library-pick-hub";
import { DesktopInvoicesReceiptsWorkspace } from "./documents/desktop-invoices-receipts-workspace";
import { UI_TEXT } from "../lib/ui-text";

interface DesktopAppMainProps {
  store: DesktopStore;
  isInvoicesReceiptsWorkspaceOpen: boolean;
  isPeopleSectionOpen: boolean;
  isAlbumsSectionOpen: boolean;
  mainPaneViewMode: MainPaneViewMode;
  isInsightsDuplicateFilesHubOpen: boolean;
  isInsightsFolderAnalysisHubOpen: boolean;
  isInsightsWronglyRotatedHubOpen: boolean;
  libraryRoots: DesktopStoreState["libraryRoots"];
  onCheckDuplicateFilesFromInsightsHub: (folderPath: string) => void;
  onOpenFolderAiSummaryFromInsightsHub: (folderPath: string) => void;
  onOpenWronglyRotatedFromInsightsHub: (folderPath: string) => void;
  albumWorkspaceMode: AlbumWorkspaceMode;
  setAlbumWorkspaceMode: Dispatch<SetStateAction<AlbumWorkspaceMode>>;
  smartAlbumRootKind: SmartAlbumRootKind;
  yearAreaSubView: SmartAlbumYearAreaSubView;
  onYearAreaSubViewChange: Dispatch<SetStateAction<SmartAlbumYearAreaSubView>>;
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
  setMainPaneViewMode: Dispatch<SetStateAction<MainPaneViewMode>>;
  rotationReviewScope: RotationReviewScope | null;
  setRotationReviewScope: Dispatch<SetStateAction<RotationReviewScope | null>>;
  onOpenRotationReview: (folderPath: string, includeSubfolders: boolean) => void;
  onOpenImageEditSuggestions: () => void;
  onCloseSpecialMainPaneView: () => void;
  pipeline: DesktopPipelineHandlers;
  handleOpenFolderAiSummary: (folderPath: string) => void;
  folderAiSummaryPathOverride: string | null;
  onFolderAiSummaryClosed: () => void;
  imageEditSuggestionItems: ImageEditSuggestionsItem[];
  isFolderLoading: boolean;
  folderLoadProgress: { loaded: number; total: number | null };
  filteredMediaItems: DesktopFilteredMediaItem[];
  semanticResults: SemanticSearchResult[];
  displaySemanticResults: SemanticSearchResult[];
  filteredDisplaySemanticResults: SemanticSearchResult[];
  filteredSemanticListItems: DesktopSemanticListItem[];
  openFolderViewerById: (itemId: string, catalogSourcePath?: string | null) => void;
  progressPanelCollapsed: boolean;
  setProgressPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  analysisEta: AnalysisEtaState;
  faceEta: FaceEtaState;
  metadataProgress: MetadataProgressState;
  semanticIndexEta: SemanticIndexEtaState;
  descEmbedBackfill: DescEmbedBackfillState;
  setDescEmbedBackfill: Dispatch<SetStateAction<DescEmbedBackfillState>>;
  similarImagesSession: SimilarImagesSession | null;
  similarImagesPage: number;
  onSimilarImagesPageChange: Dispatch<SetStateAction<number>>;
  onCloseSimilarImages: () => void;
  onSimilarImagesMinSimilarityChange: (minSimilarity: number) => void;
  onFindSimilar: (filePath: string) => void;
  duplicateFilesSession: DuplicateFilesSession | null;
  duplicateFilesPage: number;
  onDuplicateFilesPageChange: Dispatch<SetStateAction<number>>;
  onCloseDuplicateFiles: () => void;
  onDuplicateFilesDeletedMediaItems: (mediaItemIds: readonly string[]) => void;
}

export function DesktopAppMain({
  store,
  isInvoicesReceiptsWorkspaceOpen,
  isPeopleSectionOpen,
  isAlbumsSectionOpen,
  mainPaneViewMode,
  isInsightsDuplicateFilesHubOpen,
  isInsightsFolderAnalysisHubOpen,
  isInsightsWronglyRotatedHubOpen,
  libraryRoots,
  onCheckDuplicateFilesFromInsightsHub,
  onOpenFolderAiSummaryFromInsightsHub,
  onOpenWronglyRotatedFromInsightsHub,
  albumWorkspaceMode,
  setAlbumWorkspaceMode,
  smartAlbumRootKind,
  yearAreaSubView,
  onYearAreaSubViewChange,
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
  setMainPaneViewMode,
  rotationReviewScope,
  setRotationReviewScope,
  onOpenRotationReview,
  onOpenImageEditSuggestions,
  onCloseSpecialMainPaneView,
  pipeline,
  handleOpenFolderAiSummary,
  folderAiSummaryPathOverride,
  onFolderAiSummaryClosed,
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
  similarImagesSession,
  similarImagesPage,
  onSimilarImagesPageChange,
  onCloseSimilarImages,
  onSimilarImagesMinSimilarityChange,
  onFindSimilar,
  duplicateFilesSession,
  duplicateFilesPage,
  onDuplicateFilesPageChange,
  onCloseDuplicateFiles,
  onDuplicateFilesDeletedMediaItems,
}: DesktopAppMainProps): ReactElement {
  return (
    <main className="main-panel relative flex min-h-0 min-w-0 flex-col overflow-hidden">
      {/* Duplicate-files view takes precedence when both overlap (latest workflow wins). */}
      {duplicateFilesSession ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {duplicateFilesSession.kind === "scanning" ? (
            <DesktopDuplicateFilesScanningShell
              folderPath={duplicateFilesSession.folderPath}
              recursive={duplicateFilesSession.recursive}
              onClose={onCloseDuplicateFiles}
            />
          ) : (
            <DesktopDuplicateFilesWorkspace
              payload={duplicateFilesSession.payload}
              currentPage={duplicateFilesPage}
              onPageChange={onDuplicateFilesPageChange}
              onClose={onCloseDuplicateFiles}
              onDeletedMediaItems={onDuplicateFilesDeletedMediaItems}
            />
          )}
        </div>
      ) : similarImagesSession ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DesktopSimilarImagesWorkspace
            store={store}
            session={similarImagesSession}
            currentPage={similarImagesPage}
            onPageChange={onSimilarImagesPageChange}
            onClose={onCloseSimilarImages}
            onMinSimilarityChange={onSimilarImagesMinSimilarityChange}
          />
        </div>
      ) : isInsightsDuplicateFilesHubOpen ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopInsightLibraryPickHub
            title={UI_TEXT.insightsDuplicateFilesNav}
            emptyMessage={UI_TEXT.duplicateFilesInsightHubEmpty}
            libraryRoots={libraryRoots}
            onPickLibrary={onCheckDuplicateFilesFromInsightsHub}
          />
        </div>
      ) : isInsightsFolderAnalysisHubOpen ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopInsightLibraryPickHub
            title={UI_TEXT.insightsFolderAnalysisStatusNav}
            emptyMessage={UI_TEXT.duplicateFilesInsightHubEmpty}
            libraryRoots={libraryRoots}
            onPickLibrary={onOpenFolderAiSummaryFromInsightsHub}
          />
        </div>
      ) : isInsightsWronglyRotatedHubOpen ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopInsightLibraryPickHub
            title={UI_TEXT.insightsWronglyRotatedImagesNav}
            emptyMessage={UI_TEXT.duplicateFilesInsightHubEmpty}
            libraryRoots={libraryRoots}
            onPickLibrary={onOpenWronglyRotatedFromInsightsHub}
          />
        </div>
      ) : isInvoicesReceiptsWorkspaceOpen &&
        mainPaneViewMode !== "folderAiSummary" &&
        mainPaneViewMode !== "imageEditSuggestions" ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DesktopInvoicesReceiptsWorkspace onOpenItem={openFolderViewerById} />
        </div>
      ) : isAlbumsSectionOpen &&
        mainPaneViewMode !== "folderAiSummary" &&
        mainPaneViewMode !== "imageEditSuggestions" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DesktopAlbumsWorkspace
            mode={albumWorkspaceMode}
            onModeChange={setAlbumWorkspaceMode}
            smartAlbumRootKind={smartAlbumRootKind}
            yearAreaSubView={yearAreaSubView}
            onYearAreaSubViewChange={onYearAreaSubViewChange}
            searchControlsOpen={albumSearchControlsOpen}
            onSearchControlsOpenChange={setAlbumSearchControlsOpen}
            onFindSimilar={onFindSimilar}
          />
        </div>
      ) : isPeopleSectionOpen &&
        mainPaneViewMode !== "folderAiSummary" &&
        mainPaneViewMode !== "imageEditSuggestions" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopPeopleSection onOpenFacePhoto={openFacePhotoInViewer} />
        </div>
      ) : isSettingsSectionOpen &&
        mainPaneViewMode !== "folderAiSummary" &&
        mainPaneViewMode !== "imageEditSuggestions" ? (
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
          {mainPaneViewMode !== "folderAiSummary" && mainPaneViewMode !== "imageEditSuggestions" ? (
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
              onOpenFolderAiSummary={handleOpenFolderAiSummary}
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
              onOpenImageEditSuggestions={onOpenImageEditSuggestions}
              pipeline={pipeline}
            />
          ) : null}
          <DesktopMediaWorkspace
            store={store}
            mainPaneViewMode={mainPaneViewMode}
            setMainPaneViewMode={setMainPaneViewMode}
            rotationReviewScope={rotationReviewScope}
            setRotationReviewScope={setRotationReviewScope}
            onOpenRotationReview={onOpenRotationReview}
            onCloseSpecialMainPaneView={onCloseSpecialMainPaneView}
            selectedFolder={selectedFolder}
            semanticPanelOpen={semanticPanelOpen}
            pipeline={pipeline}
            handleOpenFolderAiSummary={handleOpenFolderAiSummary}
            folderAiSummaryPathOverride={folderAiSummaryPathOverride}
            onFolderAiSummaryClosed={onFolderAiSummaryClosed}
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
            onFindSimilar={onFindSimilar}
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
        onCancelImageRotation={() => void pipeline.handleCancelImageRotation()}
        descEmbedBackfill={descEmbedBackfill}
        onCancelDescEmbedBackfill={() => void pipeline.handleCancelDescEmbedBackfill()}
        onDismissDescEmbedBackfill={() => setDescEmbedBackfill((prev) => ({ ...prev, panelVisible: false }))}
      />
    </main>
  );
}
