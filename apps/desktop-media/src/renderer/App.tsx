import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { MediaSwiperViewer } from "@emk/media-viewer";
import {
  DEFAULT_THUMBNAIL_QUICK_FILTERS,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import type { SmartAlbumRootKind } from "@emk/shared-contracts";
import type { DesktopMediaItemMetadata } from "../shared/ipc";
import { supportsThinkingMode } from "../shared/photo-analysis-prompt";
import { DesktopAppMain } from "./components/DesktopAppMain";
import { DesktopAppSidebar } from "./components/DesktopAppSidebar";
import { DesktopSwiperInfoPanel } from "./components/DesktopSwiperInfoPanel";
import { useAppStoreSideEffects } from "./hooks/use-app-store-side-effects";
import { useDescEmbedBackfill } from "./hooks/use-desc-embed-backfill";
import { useDesktopPipelineHandlers } from "./hooks/use-desktop-pipeline-handlers";
import { useDesktopViewerBridge } from "./hooks/use-desktop-viewer-bridge";
import { useFolderImagesStream } from "./hooks/use-folder-images-stream";
import { useFolderMetadataMerge } from "./hooks/use-folder-metadata-merge";
import { useFolderTreeHandlers } from "./hooks/use-folder-tree-handlers";
import { useMainPaneMenus } from "./hooks/use-main-pane-menus";
import {
  useDesktopFaceServicePolling,
  useDesktopInitialization,
  useDesktopIpcBindings,
  useDesktopSettingsPersistence,
} from "./hooks/useDesktopIpcBindings";
import { usePipelineQueueBinding } from "./hooks/use-pipeline-queue-binding";
import { useFilteredMediaItems } from "./hooks/use-filtered-media-items";
import { lookupMediaMetadataByItemId } from "./lib/media-metadata-lookup";
import { useAnalysisEta, useFaceDetectionEta, useMetadataProgress, useSemanticIndexEta } from "./hooks/use-eta-tracking";
import { UI_TEXT } from "./lib/ui-text";
import { cn } from "./lib/cn";
import { useDesktopStore, useDesktopStoreApi } from "./stores/desktop-store";
import type { AlbumWorkspaceMode, MainPaneViewMode, RotationReviewScope, SidebarSectionId } from "./types/app-types";
import type { DesktopViewerItem } from "./types/viewer-types";

const RECENT_ALBUM_IDS_STORAGE_KEY = "desktop-media.recentAlbumIds.v1";

export function App(): ReactElement {
  const store = useDesktopStoreApi();

  useDesktopIpcBindings();
  useDesktopInitialization();
  useDesktopFaceServicePolling();
  useDesktopSettingsPersistence();
  usePipelineQueueBinding();

  const libraryRoots = useDesktopStore((s) => s.libraryRoots);
  const sidebarCollapsed = useDesktopStore((s) => s.sidebarCollapsed);
  const expandedFolders = useDesktopStore((s) => s.expandedFolders);
  const selectedFolder = useDesktopStore((s) => s.selectedFolder);
  const childrenByPath = useDesktopStore((s) => s.childrenByPath);
  const folderAnalysisByPath = useDesktopStore((s) => s.folderAnalysisByPath);
  const folderRollupByPath = useDesktopStore((s) => s.folderRollupByPath);
  const isFolderLoading = useDesktopStore((s) => s.isFolderLoading);
  const mediaItems = useDesktopStore((s) => s.mediaItems);
  const mediaMetadataByItemId = useDesktopStore((s) => s.mediaMetadataByItemId);
  const viewMode = useDesktopStore((s) => s.viewMode);
  const hideAdvancedSettings = useDesktopStore((s) => s.hideAdvancedSettings);
  const viewerOpen = useDesktopStore((s) => s.viewerOpen);
  const viewerCurrentIndex = useDesktopStore((s) => s.viewerCurrentIndex);
  const viewerShowInfoPanel = useDesktopStore((s) => s.viewerShowInfoPanel);
  const viewerAutoPlayInitialVideo = useDesktopStore((s) => s.viewerAutoPlayInitialVideo);
  const aiStatus = useDesktopStore((s) => s.aiStatus);
  const aiJobId = useDesktopStore((s) => s.aiJobId);
  const aiSelectedModel = useDesktopStore((s) => s.aiSelectedModel);
  const aiThinkingEnabled = useDesktopStore((s) => s.aiThinkingEnabled);
  const faceStatus = useDesktopStore((s) => s.faceStatus);
  const faceJobId = useDesktopStore((s) => s.faceJobId);
  const faceDetectionSettings = useDesktopStore((s) => s.faceDetectionSettings);
  const wrongImageRotationDetectionSettings = useDesktopStore(
    (s) => s.wrongImageRotationDetectionSettings,
  );
  const photoAnalysisSettings = useDesktopStore((s) => s.photoAnalysisSettings);
  const folderScanningSettings = useDesktopStore((s) => s.folderScanningSettings);
  const smartAlbumSettings = useDesktopStore((s) => s.smartAlbumSettings);
  const aiImageSearchSettings = useDesktopStore((s) => s.aiImageSearchSettings);
  const mediaViewerSettings = useDesktopStore((s) => s.mediaViewerSettings);
  const pathExtractionSettings = useDesktopStore((s) => s.pathExtractionSettings);
  const aiInferencePreferredGpuId = useDesktopStore((s) => s.aiInferencePreferredGpuId);
  const aiInferenceGpuOptions = useDesktopStore((s) => s.aiInferenceGpuOptions);
  const semanticQuery = useDesktopStore((s) => s.semanticQuery);
  const semanticResults = useDesktopStore((s) => s.semanticResults);
  const semanticPanelOpen = useDesktopStore((s) => s.semanticPanelOpen);
  const semanticIndexJobId = useDesktopStore((s) => s.semanticIndexJobId);
  const metadataJobId = useDesktopStore((s) => s.metadataJobId);
  const metadataPanelVisible = useDesktopStore((s) => s.metadataPanelVisible);
  const metadataStatus = useDesktopStore((s) => s.metadataStatus);
  const semanticIndexStatus = useDesktopStore((s) => s.semanticIndexStatus);
  const pathAnalysisStatus = useDesktopStore((s) => s.pathAnalysisStatus);
  const pathAnalysisJobId = useDesktopStore((s) => s.pathAnalysisJobId);
  const faceModelDownload = useDesktopStore((s) => s.faceModelDownload);
  const recentAlbumIds = useDesktopStore((s) => s.recentAlbumIds);

  const [quickFilters, setQuickFilters] = useState<ThumbnailQuickFilterState>(DEFAULT_THUMBNAIL_QUICK_FILTERS);
  const {
    filteredMediaItems,
    displaySemanticResults,
    filteredDisplaySemanticResults,
    filteredSemanticListItems,
    viewerItems,
    imageEditSuggestionItems,
    quickFiltersActiveCount,
  } = useFilteredMediaItems(quickFilters);
  const analysisEta = useAnalysisEta();
  const faceEta = useFaceDetectionEta();
  const metadataProgress = useMetadataProgress();
  const semanticIndexEta = useSemanticIndexEta();

  const [progressPanelCollapsed, setProgressPanelCollapsed] = useState(false);
  const [activeSidebarSection, setActiveSidebarSection] = useState<SidebarSectionId>("folders");
  const [expandedSidebarSection, setExpandedSidebarSection] = useState<SidebarSectionId | null>("folders");
  const [mainPaneViewMode, setMainPaneViewMode] = useState<MainPaneViewMode>("media");
  const [rotationReviewScope, setRotationReviewScope] = useState<RotationReviewScope | null>(null);
  const [albumWorkspaceMode, setAlbumWorkspaceMode] = useState<AlbumWorkspaceMode>("list");
  const [albumSearchControlsOpen, setAlbumSearchControlsOpen] = useState(false);
  const [smartAlbumRootKind, setSmartAlbumRootKind] = useState<SmartAlbumRootKind>("country-year-city");
  const [recentAlbumsHydrated, setRecentAlbumsHydrated] = useState(false);

  const {
    actionsMenuOpen,
    setActionsMenuOpen,
    quickFiltersMenuOpen,
    setQuickFiltersMenuOpen,
    actionsMenuWrapRef,
    quickFiltersMenuWrapRef,
  } = useMainPaneMenus();

  const {
    descEmbedBackfill,
    setDescEmbedBackfill,
    handleIndexDescEmbeddings,
    handleCancelDescEmbedBackfill,
  } = useDescEmbedBackfill(setProgressPanelCollapsed);

  const descEmbedHandlers = useMemo(
    () => ({ handleIndexDescEmbeddings, handleCancelDescEmbedBackfill }),
    [handleIndexDescEmbeddings, handleCancelDescEmbedBackfill],
  );

  const activeFolderRequestIdRef = useRef<string | null>(null);
  const lastCompletedFolderRequestIdRef = useRef<string | null>(null);
  const { mergeMetadataForPaths, refreshMetadataByPath } = useFolderMetadataMerge(
    activeFolderRequestIdRef,
    lastCompletedFolderRequestIdRef,
    store,
  );
  const { folderLoadProgress, setFolderLoadProgress } = useFolderImagesStream(
    store,
    mergeMetadataForPaths,
    activeFolderRequestIdRef,
    lastCompletedFolderRequestIdRef,
    setMainPaneViewMode,
  );

  const folderTree = useFolderTreeHandlers({
    store,
    expandedFolders,
    activeFolderRequestIdRef,
    lastCompletedFolderRequestIdRef,
    setFolderLoadProgress,
    setMainPaneViewMode,
  });

  const pipeline = useDesktopPipelineHandlers({
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
  });

  const { openFolderViewerById, openFacePhotoInViewer } = useDesktopViewerBridge({
    store,
    mediaItems,
    refreshMetadataByPath,
  });

  const semanticModeActive = semanticResults.length > 0;
  const mediaImagesCount = useMemo(
    () => mediaItems.filter((item) => item.mediaType !== "video").length,
    [mediaItems],
  );
  const mediaVideosCount = useMemo(
    () => mediaItems.filter((item) => item.mediaType === "video").length,
    [mediaItems],
  );

  const prevSemanticModeActiveRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevSemanticModeActiveRef.current;
    prevSemanticModeActiveRef.current = semanticModeActive;
    if (prev === null) {
      return;
    }
    if (prev !== semanticModeActive) {
      setQuickFilters(DEFAULT_THUMBNAIL_QUICK_FILTERS);
    }
  }, [semanticModeActive]);
  const selectedFolderLabel = useMemo(() => selectedFolder ?? UI_TEXT.noFolder, [selectedFolder]);
  const selectedModelSupportsThinking = useMemo(() => supportsThinkingMode(aiSelectedModel), [aiSelectedModel]);

  const aiPipelineStripRefreshKey = useMemo(
    () =>
      [
        selectedFolder ?? "",
        aiStatus,
        faceStatus,
        semanticIndexStatus,
        metadataStatus,
        metadataJobId ?? "",
        pathAnalysisStatus,
        pathAnalysisJobId ?? "",
      ].join("|"),
    [
      selectedFolder,
      aiStatus,
      faceStatus,
      semanticIndexStatus,
      metadataStatus,
      metadataJobId,
      pathAnalysisStatus,
      pathAnalysisJobId,
    ],
  );

  useAppStoreSideEffects({
    store,
    photoAnalysisSettingsModel: photoAnalysisSettings.model,
    metadataPanelVisible,
    setProgressPanelCollapsed,
    selectedModelSupportsThinking,
    aiThinkingEnabled,
    sidebarCollapsed,
    setExpandedSidebarSection,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_ALBUM_IDS_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        store.getState().setRecentAlbumIds(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      // Ignore corrupt local UI preference state.
    } finally {
      setRecentAlbumsHydrated(true);
    }
  }, [store]);

  useEffect(() => {
    if (!recentAlbumsHydrated) return;
    window.localStorage.setItem(RECENT_ALBUM_IDS_STORAGE_KEY, JSON.stringify(recentAlbumIds));
  }, [recentAlbumIds, recentAlbumsHydrated]);

  const renderViewerInfoPanel = (item: DesktopViewerItem): ReactElement => {
    const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(item.sourcePath, mediaMetadataByItemId);
    return (
      <DesktopSwiperInfoPanel item={item} metadata={metadata} onRefreshMetadata={refreshMetadataByPath} />
    );
  };

  const handleSidebarSectionToggle = (sectionId: string): void => {
    if (sectionId === "folders" || sectionId === "albums" || sectionId === "people" || sectionId === "settings") {
      if (sectionId === "albums" && activeSidebarSection !== "albums") {
        setAlbumSearchControlsOpen(false);
      }
      setActiveSidebarSection(sectionId);
      if (sidebarCollapsed) {
        if (sectionId === "folders" || sectionId === "albums") {
          store.getState().setSidebarCollapsed(false);
          setExpandedSidebarSection(sectionId);
          return;
        }
        setExpandedSidebarSection(null);
        return;
      }
      setExpandedSidebarSection((current) => (current === sectionId ? null : sectionId));
    }
  };

  const openAlbumsSection = (): void => {
    setActiveSidebarSection("albums");
    setExpandedSidebarSection("albums");
    if (sidebarCollapsed) {
      store.getState().setSidebarCollapsed(false);
    }
  };

  const handleCreateAlbumFromSidebar = (): void => {
    openAlbumsSection();
    store.getState().selectAlbum(null);
    setAlbumWorkspaceMode("create");
  };

  const handleAlbumSelectedFromSidebar = (): void => {
    openAlbumsSection();
    setAlbumWorkspaceMode("detail");
  };

  const handleShowAlbumListFromSidebar = (): void => {
    openAlbumsSection();
    store.getState().selectAlbum(null);
    setAlbumWorkspaceMode("list");
    setAlbumSearchControlsOpen(true);
  };

  const handleSmartAlbumSelectedFromSidebar = (kind: SmartAlbumRootKind): void => {
    openAlbumsSection();
    store.getState().selectAlbum(null);
    setSmartAlbumRootKind(kind);
    setAlbumWorkspaceMode("smart");
    setAlbumSearchControlsOpen(false);
  };

  const openImageEditSuggestions = useCallback((): void => {
    setRotationReviewScope(null);
    setMainPaneViewMode("imageEditSuggestions");
  }, []);

  const openRotationReview = useCallback((folderPath: string, includeSubfolders: boolean): void => {
    setRotationReviewScope({ folderPath, includeSubfolders });
    setMainPaneViewMode("imageEditSuggestions");
  }, []);

  const isPeopleSectionOpen = activeSidebarSection === "people";
  const isAlbumsSectionOpen = activeSidebarSection === "albums";
  const isSettingsSectionOpen = activeSidebarSection === "settings";

  return (
    <div
      className={cn(
        "grid h-screen",
        sidebarCollapsed ? "grid-cols-[84px_1fr]" : "grid-cols-[320px_1fr]",
      )}
    >
      <DesktopAppSidebar
        store={store}
        sidebarCollapsed={sidebarCollapsed}
        activeSidebarSection={activeSidebarSection}
        expandedSidebarSection={expandedSidebarSection}
        onSectionToggle={handleSidebarSectionToggle}
        libraryRoots={libraryRoots}
        selectedFolder={selectedFolder}
        expandedFolders={expandedFolders}
        childrenByPath={childrenByPath}
        folderAnalysisByPath={folderAnalysisByPath}
        folderRollupByPath={folderRollupByPath}
        pipeline={pipeline}
        onCreateAlbum={handleCreateAlbumFromSidebar}
        onAlbumSelected={handleAlbumSelectedFromSidebar}
        onSmartAlbumSelected={handleSmartAlbumSelectedFromSidebar}
        onShowAlbumList={handleShowAlbumListFromSidebar}
        folderTree={folderTree}
      />

      <DesktopAppMain
        store={store}
        isPeopleSectionOpen={isPeopleSectionOpen}
        isAlbumsSectionOpen={isAlbumsSectionOpen}
        albumWorkspaceMode={albumWorkspaceMode}
        setAlbumWorkspaceMode={setAlbumWorkspaceMode}
        smartAlbumRootKind={smartAlbumRootKind}
        albumSearchControlsOpen={albumSearchControlsOpen}
        setAlbumSearchControlsOpen={setAlbumSearchControlsOpen}
        isSettingsSectionOpen={isSettingsSectionOpen}
        openFacePhotoInViewer={openFacePhotoInViewer}
        faceDetectionSettings={faceDetectionSettings}
        wrongImageRotationDetectionSettings={wrongImageRotationDetectionSettings}
        photoAnalysisSettings={photoAnalysisSettings}
        folderScanningSettings={folderScanningSettings}
        smartAlbumSettings={smartAlbumSettings}
        aiImageSearchSettings={aiImageSearchSettings}
        hideAdvancedSettings={hideAdvancedSettings}
        mediaViewerSettings={mediaViewerSettings}
        pathExtractionSettings={pathExtractionSettings}
        aiInferencePreferredGpuId={aiInferencePreferredGpuId}
        aiInferenceGpuOptions={aiInferenceGpuOptions}
        selectedFolderLabel={selectedFolderLabel}
        quickFiltersActiveCount={quickFiltersActiveCount}
        mediaItemsLength={mediaItems.length}
        mediaImagesCount={mediaImagesCount}
        mediaVideosCount={mediaVideosCount}
        filteredMediaItemsLength={filteredMediaItems.length}
        semanticModeActive={semanticModeActive}
        displaySemanticResultsCount={displaySemanticResults.length}
        filteredDisplaySemanticResultsCount={filteredDisplaySemanticResults.length}
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
        mainPaneViewMode={mainPaneViewMode}
        setMainPaneViewMode={setMainPaneViewMode}
        rotationReviewScope={rotationReviewScope}
        setRotationReviewScope={setRotationReviewScope}
        onOpenRotationReview={openRotationReview}
        onOpenImageEditSuggestions={openImageEditSuggestions}
        pipeline={pipeline}
        faceModelDownload={faceModelDownload}
        handleOpenFolderAiSummary={folderTree.handleOpenFolderAiSummary}
        imageEditSuggestionItems={imageEditSuggestionItems}
        isFolderLoading={isFolderLoading}
        folderLoadProgress={folderLoadProgress}
        filteredMediaItems={filteredMediaItems}
        semanticResults={semanticResults}
        displaySemanticResults={displaySemanticResults}
        filteredDisplaySemanticResults={filteredDisplaySemanticResults}
        filteredSemanticListItems={filteredSemanticListItems}
        openFolderViewerById={openFolderViewerById}
        progressPanelCollapsed={progressPanelCollapsed}
        setProgressPanelCollapsed={setProgressPanelCollapsed}
        analysisEta={analysisEta}
        faceEta={faceEta}
        metadataProgress={metadataProgress}
        semanticIndexEta={semanticIndexEta}
        descEmbedBackfill={descEmbedBackfill}
        setDescEmbedBackfill={setDescEmbedBackfill}
      />

      <MediaSwiperViewer
        isOpen={viewerOpen}
        items={viewerItems}
        currentIndex={viewerCurrentIndex}
        onIndexChange={(index) => store.getState().setViewerCurrentIndex(index)}
        onClose={() => store.getState().closeViewer()}
        renderInfoPanel={renderViewerInfoPanel}
        infoPanelOpen={viewerShowInfoPanel}
        onInfoPanelOpenChange={(open) => store.getState().setViewerShowInfoPanel(open)}
        autoPlayInitialVideo={viewerAutoPlayInitialVideo && mediaViewerSettings.autoPlayVideoOnOpen}
        autoPlayVideoOnSelection={mediaViewerSettings.autoPlayVideoOnOpen}
        skipVideosInSlideshow={mediaViewerSettings.skipVideosInSlideshow}
      />
    </div>
  );
}
